// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  PutBucketPolicyCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import {
  CloudFormationClient,
  ListStackResourcesCommand,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ECSClient, ListTasksCommand, DescribeTasksCommand } from '@aws-sdk/client-ecs';
import { randomUUID } from 'node:crypto';

import * as fs from 'fs';
import * as path from 'path';

const TEST_BUCKET_PREFIX = 'dit-e2e-playground-';
const TEST_IMAGE_KEY = 'test-images/aws_logo.png';

// The playground specs resolve a real image request against this mapping; they only
// need the mapping to resolve, so the path pattern is what matters (the names are cosmetic).
const PLAYGROUND_ORIGIN_NAME = 'PG Test Origin';
const PLAYGROUND_POLICY_NAME = 'PG Test Policy';
const PLAYGROUND_MAPPING_NAME = 'PG Test Mapping';
const PLAYGROUND_PATH_PATTERN = '/test-images/*';

// Hardcoded ECS cluster/service names (see constructs/lib/v8/constructs/processor/alb-ecs-construct.ts:86,158).
const ECS_CLUSTER_NAME = 'dit-cluster';
const ECS_SERVICE_NAME = 'dit-service';

// Test image is loaded from the fixtures directory
let cachedBucketName: string | null = null;

// Timestamp (ms) of the last config-table provisioning write. The awaitReady
// poll uses this to key on a deployment NEWER than the write, so it never reads
// a stale pre-existing stable deployment and returns before the new config is live.
let provisionedAtMs: number | null = null;

function getOrCreateBucketName(): string {
  if (!cachedBucketName) {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    cachedBucketName = `${TEST_BUCKET_PREFIX}${randomSuffix}`;
  }
  return cachedBucketName;
}

async function getAccountId(region: string): Promise<string> {
  const sts = new STSClient({ region });
  const response = await sts.send(new GetCallerIdentityCommand({}));
  return response.Account!;
}

async function getEcsTaskRoleArn(stackName: string, region: string): Promise<string> {
  const cfn = new CloudFormationClient({ region });

  // Get the ImageProcessing nested stack
  const parentResources = await cfn.send(new ListStackResourcesCommand({ StackName: stackName }));
  const imageProcessingStack = parentResources.StackResourceSummaries?.find(
    (r) => r.LogicalResourceId?.includes('ImageProcessing') && r.ResourceType === 'AWS::CloudFormation::Stack'
  );
  if (!imageProcessingStack?.PhysicalResourceId) {
    throw new Error('ImageProcessing nested stack not found');
  }

  // Get resources in the nested stack to find Container construct
  const nestedResources = await cfn.send(new ListStackResourcesCommand({
    StackName: imageProcessingStack.PhysicalResourceId
  }));
  const containerTaskRole = nestedResources.StackResourceSummaries?.find(
    (r) => r.LogicalResourceId?.includes('ContainerTaskRole') && r.ResourceType === 'AWS::IAM::Role'
  );
  if (!containerTaskRole?.PhysicalResourceId) {
    throw new Error('ContainerTaskRole not found in ImageProcessing nested stack');
  }

  const accountId = await getAccountId(region);
  return `arn:aws:iam::${accountId}:role/${containerTaskRole.PhysicalResourceId}`;
}

/**
 * Resolve the DIT config table name from the parent stack outputs. Mirrors the
 * teardown lookup in plugins/index.ts (output key starts with DataAccessLayerConfigTableName).
 */
async function getConfigTableName(stackName: string, region: string): Promise<string> {
  const cfn = new CloudFormationClient({ region });
  const response = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
  const tableName = response.Stacks?.[0]?.Outputs?.find(
    (o) => o.OutputKey?.startsWith('DataAccessLayerConfigTableName')
  )?.OutputValue;
  if (!tableName) {
    throw new Error('Could not find DataAccessLayerConfigTableName* in stack outputs');
  }
  return tableName;
}

/**
 * Create the S3 test bucket, upload the test image, and grant the ECS task role read
 * access. Idempotent (safe to re-run against a persistent stack).
 */
async function setupTestBucket(stackName: string, region: string, bucketName?: string) {
  const s3 = new S3Client({ region });

  const actualBucketName = bucketName || getOrCreateBucketName();
  cachedBucketName = actualBucketName;
  console.log(`Creating test bucket: ${actualBucketName}`);

  // 1. Create S3 bucket (idempotent - ignore if exists)
  try {
    await s3.send(new CreateBucketCommand({
      Bucket: actualBucketName,
      ...(region !== 'us-east-1' && {
        CreateBucketConfiguration: { LocationConstraint: region as BucketLocationConstraint },
      }),
    }));
  } catch (e: any) {
    if (e.name !== 'BucketAlreadyOwnedByYou') throw e;
    console.log(`Bucket ${actualBucketName} already exists, reusing`);
  }

  // 2. Upload test image
  const imagePath = path.join(__dirname, '../../../aws_logo.png');
  const imageBuffer = fs.readFileSync(imagePath);
  await s3.send(new PutObjectCommand({
    Bucket: actualBucketName,
    Key: TEST_IMAGE_KEY,
    Body: imageBuffer,
    ContentType: 'image/png',
  }));
  console.log(`Uploaded test image to s3://${actualBucketName}/${TEST_IMAGE_KEY}`);

  // 3. Get ECS task role ARN and update bucket policy
  const taskRoleArn = await getEcsTaskRoleArn(stackName, region);
  console.log(`ECS Task Role ARN: ${taskRoleArn}`);

  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowECSTaskRole',
        Effect: 'Allow',
        Principal: { AWS: taskRoleArn },
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${actualBucketName}/*`,
      },
    ],
  };

  await s3.send(new PutBucketPolicyCommand({
    Bucket: actualBucketName,
    Policy: JSON.stringify(bucketPolicy),
  }));
  console.log('Bucket policy updated with ECS task role access');

  return {
    bucketName: actualBucketName,
    bucketDomain: `${actualBucketName}.s3.${region}.amazonaws.com`,
    testImagePath: `/${TEST_IMAGE_KEY}`,
  };
}

/**
 * Write the origin/policy/mapping fixtures directly to the DIT config table via the
 * DynamoDB SDK, bypassing the Admin API. The persisted shapes mirror exactly what
 * management-lambda's DAOs write (single PK, GSI-discriminated by GSI1PK, policyJSON
 * stored as a stringified blob, mappings referencing origin/policy by UUID). See:
 *   - management-lambda/dao/origin-dao.ts:27-41
 *   - management-lambda/dao/transformation-policy-dao.ts:60-75
 *   - management-lambda/dao/mapping-dao.ts:130-151
 *
 * Runs at t=0 (before:run) to give the 180s DDB-stream batch window + ECS rollout a head
 * start before the playground island runs. This is only an optimization — correctness does
 * NOT depend on propagation finishing in a quiet window (the CRUD specs keep writing to the
 * same table all run long, spec ordering isn't fixed). The island's awaitReady poll keys on
 * task freshness to confirm a task serving our fixtures is live (see awaitEcsReady below).
 */
async function provisionPlaygroundFixtures({
  stackName,
  region,
  bucketDomain,
}: {
  stackName: string;
  region: string;
  bucketDomain: string;
}): Promise<void> {
  const tableName = await getConfigTableName(stackName, region);
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });

  const now = new Date().toISOString();
  const originId = randomUUID();
  const policyId = randomUUID();
  const mappingId = randomUUID();

  // Single grayscale transformation — matches data-models policySchema; stored as a
  // JSON string in Data.policyJSON (the container JSON.parses it back).
  const policyJSON = JSON.stringify({
    transformations: [{ transformation: 'grayscale', value: true }],
  });

  const originItem = {
    PK: originId,
    Data: {
      originName: PLAYGROUND_ORIGIN_NAME,
      originDomain: bucketDomain,
    },
    GSI1PK: 'ORIGIN',
    GSI1SK: PLAYGROUND_ORIGIN_NAME,
    CreatedAt: now,
  };

  const policyItem = {
    PK: policyId,
    Data: {
      policyName: PLAYGROUND_POLICY_NAME,
      policyJSON,
      isDefault: false,
    },
    GSI1PK: 'POLICY',
    GSI1SK: PLAYGROUND_POLICY_NAME,
    CreatedAt: now,
  };

  const mappingItem = {
    PK: mappingId,
    Data: {
      mappingName: PLAYGROUND_MAPPING_NAME,
      originId,
      policyId,
    },
    GSI1PK: 'PATH_MAPPING',
    GSI1SK: PLAYGROUND_PATH_PATTERN,
    GSI2PK: `ORIGIN#${originId}`,
    GSI3PK: `POLICY#${policyId}`,
    CreatedAt: now,
  };

  await ddb.send(new BatchWriteCommand({
    RequestItems: {
      [tableName]: [
        { PutRequest: { Item: originItem } },
        { PutRequest: { Item: policyItem } },
        { PutRequest: { Item: mappingItem } },
      ],
    },
  }));

  // Start the freshness clock: awaitReady must observe an ECS deployment created
  // after this moment (a config write triggers DDB stream -> utility-lambda ->
  // ecs:UpdateService(forceNewDeployment)).
  provisionedAtMs = Date.now();

  console.log(
    `[playground] Provisioned config-table fixtures: origin=${originId}, policy=${policyId}, ` +
    `mapping=${mappingId} (domain=${bucketDomain}, path=${PLAYGROUND_PATH_PATTERN}), ` +
    `freshness floor=${new Date(provisionedAtMs).toISOString()}`
  );
}

/**
 * Poll ECS until the config change has propagated to the tasks actually serving traffic.
 *
 * We do NOT reason about deployments (PRIMARY/ACTIVE/rolloutState). Under the write pressure
 * of a full E2E run — the origin/mapping/policy CRUD specs each mutate the same config table,
 * and every write is a DDB-stream event → utility-lambda → ecs:UpdateService(forceNewDeployment)
 * — deployments are issued continuously and each one supersedes (clobbers) the in-progress
 * rollout before it completes. "Did deployment A settle?" is therefore unanswerable: A may have
 * been cancelled by B.
 *
 * Instead we key on TASK freshness, which is always answerable. The container reads the config
 * table exactly ONCE, at startup (`warmCache()` in initializeContainer — no TTL, no polling,
 * no runtime refresh), and only reports the /health endpoint 200 (→ becomes a healthy ALB
 * target) AFTER that warm completes. So:
 *
 *   task.startedAt > provisionedAtMs  ⟹  that task warmed its cache after our write  ⟹  it serves our fixtures.
 *
 * In-progress redeployments are irrelevant: the ALB can only route a request to a task that is
 * RUNNING, so the single condition we need is that EVERY running task is fresh. We deliberately do
 * NOT also require runningCount === desiredCount — a routable task is necessarily RUNNING, so
 * "all RUNNING tasks fresh" is already sufficient, and gating on the count settling only adds false
 * negatives while tasks spin up or drain.
 *
 * We compare against startedAt (when the container process ran warmCache), not createdAt (when
 * ECS provisioned the slot) — a slot created before our write can still warm its cache after it.
 */
async function awaitEcsReady(region: string): Promise<void> {
  const ecs = new ECSClient({ region });

  const freshnessFloorMs = provisionedAtMs ?? 0;
  const totalRetries = 36;            // up to 36 * 15s = 9 min, inside the 15-min task timeout
  const retryIntervalMs = 15_000;

  // Log the floor up front — an instant pass or an UNSET floor (provisioning never ran) is then
  // diagnosable from the run log alone.
  const pollStartMs = Date.now();
  if (freshnessFloorMs) {
    console.log(`[playground] awaitReady start: freshness floor=${new Date(freshnessFloorMs).toISOString()}`);
  } else {
    console.warn(
      '[playground] awaitReady start: freshness floor UNSET (playground:provision never ran?) — ' +
      'poll fails OPEN, all running tasks will look fresh'
    );
  }

  for (let attempt = 1; attempt <= totalRetries; attempt++) {
    // List the tasks currently RUNNING for this service and read their startedAt.
    const listed = await ecs.send(
      new ListTasksCommand({ cluster: ECS_CLUSTER_NAME, serviceName: ECS_SERVICE_NAME, desiredStatus: 'RUNNING' })
    );
    const taskArns = listed.taskArns ?? [];
    const described = taskArns.length
      ? await ecs.send(new DescribeTasksCommand({ cluster: ECS_CLUSTER_NAME, tasks: taskArns }))
      : { tasks: [] };
    const runningTasks = (described.tasks ?? []).filter((t) => t.lastStatus === 'RUNNING');

    // A task with no startedAt yet hasn't finished starting (so hasn't warmed its cache) —
    // treat it as not-fresh so we keep waiting rather than returning early.
    const staleTasks = runningTasks.filter(
      (t) => !t.startedAt || new Date(t.startedAt).getTime() < freshnessFloorMs
    );

    if (runningTasks.length > 0 && staleTasks.length === 0) {
      const startedAts = runningTasks
        .map((t) => t.startedAt?.toISOString?.() ?? String(t.startedAt))
        .join(', ');
      console.log(
        `[playground] ECS ready on attempt ${attempt}/${totalRetries} after ` +
        `${((Date.now() - pollStartMs) / 1000).toFixed(1)}s: all ${runningTasks.length} running task(s) ` +
        `started after the fixture write (startedAt=[${startedAts}])`
      );
      return;
    }

    // Include the stale tasks' startedAt values (not just the count) so clock skew or a
    // stuck rollout is diagnosable from the run log alone.
    const staleDetail = staleTasks
      .map((t) => `${(t.taskArn ?? '').split('/').pop()}@${t.startedAt?.toISOString?.() ?? 'not-started'}`)
      .join(', ');
    console.log(
      `[playground] awaitReady ${attempt}/${totalRetries}: runningTasks=${runningTasks.length}, ` +
      `staleTasks=${staleTasks.length}${staleDetail ? ` [${staleDetail}]` : ''}. ` +
      `Retrying in ${retryIntervalMs / 1000}s...`
    );
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
  }

  throw new Error(`ECS tasks did not all become fresh (started after the fixture write) after ${totalRetries} retries`);
}

export default (config: any) => ({
  'playground:setup': async ({ stackName, bucketName }: { stackName: string; bucketName?: string }) => {
    const region = config.env.AWS_REGION;
    return setupTestBucket(stackName, region, bucketName);
  },

  /**
   * Full playground provisioning entry point, called from before:run when the playground
   * suite is in scope. Creates the S3 bucket + image, then writes the origin/policy/mapping
   * fixtures to the config table via SDK. Returns the info the specs need.
   */
  'playground:provision': async ({ stackName }: { stackName: string }) => {
    const region = config.env.AWS_REGION;

    // S3 bucket + image + bucket policy.
    const bucketInfo = await setupTestBucket(stackName, region);

    // Write origin/policy/mapping directly to DynamoDB (bypass the Admin UI/API).
    await provisionPlaygroundFixtures({ stackName, region, bucketDomain: bucketInfo.bucketDomain });

    return bucketInfo;
  },

  /**
   * Freshness-keyed ECS readiness poll. Called from the playground island's
   * first-spec before(). Returns once a deployment created after the provisioning write
   * has fully rolled out.
   */
  'playground:awaitReady': async () => {
    const region = config.env.AWS_REGION;
    await awaitEcsReady(region);
    return null;
  },

  'playground:getBucketInfo': async () => {
    if (!cachedBucketName) return null;
    const region = config.env.AWS_REGION;
    return {
      bucketName: cachedBucketName,
      bucketDomain: `${cachedBucketName}.s3.${region}.amazonaws.com`,
      testImagePath: `/${TEST_IMAGE_KEY}`,
    };
  },

  'playground:teardown': async ({ bucketName }: { bucketName: string }) => {
    const region = config.env.AWS_REGION;
    const s3 = new S3Client({ region });

    console.log(`Cleaning up bucket: ${bucketName}`);
    try {
      const listResponse = await s3.send(new ListObjectsV2Command({ Bucket: bucketName }));
      if (listResponse.Contents) {
        for (const obj of listResponse.Contents) {
          await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key! }));
        }
      }
      await s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket ${bucketName} deleted`);
    } catch (e: any) {
      console.log(`Bucket cleanup failed (may already be deleted): ${e.name}`);
    }
    cachedBucketName = null;

    return null;
  },
});
