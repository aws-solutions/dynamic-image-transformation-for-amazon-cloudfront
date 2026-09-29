// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from './dynamodb-client';
import { ExternalOriginClient } from './external-origin-client';
import { clearState, readState } from './e2e-state';

interface TeardownTarget {
  region: string;
  configTable: string;
  testBucket?: string;
  bucketProvided: boolean;
  externalOriginBucket?: string;
  externalOriginBucketProvided: boolean;
}

// Resolves teardown targets from env (the in-process jest run) falling back to
// .e2e-state.json (the standalone `test:e2e:down` entrypoint).
function resolveTeardownTarget(): TeardownTarget | null {
  const {
    CURRENT_STACK_REGION,
    CONFIG_TABLE,
    TEST_BUCKET,
    EXTERNAL_ORIGIN_BUCKET,
    TEST_BUCKET_PROVIDED,
    EXTERNAL_ORIGIN_BUCKET_PROVIDED
  } = process.env;

  if (CURRENT_STACK_REGION && CONFIG_TABLE) {
    return {
      region: CURRENT_STACK_REGION,
      configTable: CONFIG_TABLE,
      testBucket: TEST_BUCKET,
      bucketProvided: TEST_BUCKET_PROVIDED === 'true',
      externalOriginBucket: EXTERNAL_ORIGIN_BUCKET,
      externalOriginBucketProvided: EXTERNAL_ORIGIN_BUCKET_PROVIDED === 'true'
    };
  }

  const state = readState();
  if (state) {
    return {
      region: state.region,
      configTable: state.configTable,
      testBucket: state.testBucket,
      bucketProvided: state.bucketProvided,
      externalOriginBucketProvided: false
    };
  }

  return null;
}

/**
 * Shared teardown used by the jest globalTeardown hook and the standalone
 * `test:e2e:down` entrypoint. Clears seeded DDB data, deletes auto-created
 * buckets (preserving user-provided ones), and removes the bootstrap state file.
 */
export async function runTeardown(): Promise<void> {
  const target = resolveTeardownTarget();
  if (!target) {
    return;
  }

  const ddbClient = new DynamoDBClient(target.region, target.configTable);
  await ddbClient.clearTestData();

  if (target.testBucket && !target.bucketProvided) {
    const s3Client = new (await import('./s3-client')).S3Client(target.region, target.testBucket);
    await s3Client.deleteBucket();
  }

  if (target.externalOriginBucket && !target.externalOriginBucketProvided) {
    const externalOrigin = new ExternalOriginClient(target.region);
    externalOrigin['bucketName'] = target.externalOriginBucket;
    await externalOrigin.deleteBucket();
  }

  clearState();
}

const globalTeardown = async (): Promise<void> => {
  // Skip mode runs against bootstrapped resources we must NOT destroy — the
  // developer cleans up explicitly via `npm run test:e2e:down`.
  if (process.env.SKIP_SETUP === 'true') {
    console.log('Skipping teardown (SKIP_SETUP=true) — run `npm run test:e2e:down` to clean up');
    return;
  }

  await runTeardown();
};

export default globalTeardown;
