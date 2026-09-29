// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import cognitoTasks from './tasks/cognito';
import playgroundTasks from './tasks/playground';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';

module.exports = (on: any, config: any) => {
  const tasks = cognitoTasks(config);
  const playground = playgroundTasks(config);
  on('task', {
    ...cognitoTasks(config),
    ...playground,
  });

  // Track whether we provisioned the playground bucket so after:run can tear it down.
  let provisionedBucketName: string | null = null;

  // Run setup ONCE before any spec runs
  on('before:run', async (details: any) => {
    // Auth is global — always provision the test user.
    const userPoolId = config.env.COGNITO_USER_POOL_ID;
    if (userPoolId) {
      await tasks['setup:testUser']({ userPoolId });
    }

    // Provision playground fixtures at t=0 ONLY when the playground suite is in scope, so
    // propagation (DDB stream -> utility-lambda -> ECS rollout) gets a head start before the
    // island runs, and non-playground runs pay nothing. Correctness does NOT rely on this
    // finishing in a quiet window (the CRUD specs write to the same table all run long and keep
    // ECS redeploying) — the island's playground:awaitReady poll keys on task freshness to
    // confirm a task serving our fixtures is actually live.
    const playgroundInScope = details?.specs?.some((s: any) => s.relative?.includes('/playground/'));
    // Log both branches — a mis-populated details.specs otherwise skips provisioning silently.
    console.log(
      `[before:run] @ ${new Date().toISOString()} resolved specs=${details?.specs?.length ?? 'undefined'}, ` +
      `playgroundInScope=${playgroundInScope === true}`
    );
    if (playgroundInScope) {
      const stackName = config.env.CURRENT_STACK_NAME;
      if (!stackName) {
        throw new Error('CURRENT_STACK_NAME is required to provision playground fixtures');
      }
      const info: any = await playground['playground:provision']({ stackName });
      provisionedBucketName = info?.bucketName ?? null;
      console.log('[before:run] Playground fixtures provisioned at t=0 (propagation head-start; correctness gated by awaitReady)');
    }
  });

  // Run cleanup ONCE after all specs complete (regardless of pass/fail)
  on('after:run', async () => {
    try {
      const userPoolId = config.env.COGNITO_USER_POOL_ID;
      if (userPoolId) {
        await tasks['cleanup:testUser']({ userPoolId });
      }
    } catch (e: any) {
      console.error('[after:run] cognito cleanup failed:', e.message);
    }

    // Clean up DynamoDB config table (origins, mappings, policies)
    try {
      const stackName = config.env.CURRENT_STACK_NAME;
      const region = config.env.AWS_REGION;
      if (stackName && region) {
        const cfn = new CloudFormationClient({ region });
        const response = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
        const tableName = response.Stacks?.[0]?.Outputs?.find(
          (o) => o.OutputKey?.startsWith('DataAccessLayerConfigTableName')
        )?.OutputValue;

        if (tableName) {
          const ddb = new DynamoDBClient({ region });
          let lastEvaluatedKey: any = undefined;

          do {
            const scan: any = await ddb.send(new ScanCommand({
              TableName: tableName,
              ProjectionExpression: 'PK, SK',
              ExclusiveStartKey: lastEvaluatedKey,
            }));

            const items = scan.Items || [];
            lastEvaluatedKey = scan.LastEvaluatedKey;

            // BatchWriteItem supports max 25 items per request
            for (let i = 0; i < items.length; i += 25) {
              const batch = items.slice(i, i + 25);
              await ddb.send(new BatchWriteItemCommand({
                RequestItems: {
                  [tableName]: batch.map((item: any) => ({
                    DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
                  })),
                },
              }));
            }
          } while (lastEvaluatedKey);

          console.log(`[after:run] DynamoDB table "${tableName}" cleared`);
        } else {
          console.warn('[after:run] Could not find DataAccessLayerConfigTableName418C3F73 in stack outputs');
        }
      }
    } catch (e: any) {
      console.error('[after:run] DynamoDB cleanup failed:', e.message);
    }

    // Symmetric playground bucket teardown (fixtures in the config table are already
    // cleared by the wipe above; the DDB provisioning has no separate teardown).
    try {
      if (provisionedBucketName) {
        await playground['playground:teardown']({ bucketName: provisionedBucketName });
        provisionedBucketName = null;
      }
    } catch (e: any) {
      console.error('[after:run] Playground bucket cleanup failed:', e.message);
    }
  });

  return config;
};
