// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnClient } from './cfn-client';
import { S3Client } from './s3-client';
import { ExternalOriginClient } from './external-origin-client';
import { DynamoDBClient } from './dynamodb-client';
import { EcsClient } from './ecs-client';
import { generateTestImages } from './generate-test-images';
import { E2EState, readState, writeState } from './e2e-state';
import { existsSync } from 'fs';
import { join } from 'path';

const ECS_CLUSTER_NAME = 'dit-cluster';
const ECS_SERVICE_NAME = 'dit-service';
const DDB_STREAM_BATCH_WINDOW_SECONDS = 3 * 60;
const ECS_DEPLOYMENT_TIMEOUT_SECONDS = 15 * 60;

let externalOriginClient: ExternalOriginClient | null = null;

interface SetupConfig {
  stackRegion: string;
  stackName: string;
  testBucket?: string;
  externalOriginBucket?: string;
  skipSetup: boolean;
}

interface RunSetupOptions {
  // When true, the run seeds DDB and waits for the DDB stream batch window + ECS
  // stabilization. When false (skip mode), the bucket+config are assumed to already
  // exist from a prior bootstrap, and the wait is skipped entirely.
  seed: boolean;
  // When true, the resolved bucket/stack details are persisted to .e2e-state.json so
  // a later skip-mode run can auto-discover them. Used by `test:e2e:up`.
  persist: boolean;
}

function validateAndLoadConfig(): SetupConfig {
  const { CURRENT_STACK_REGION, CURRENT_STACK_NAME, TEST_BUCKET, EXTERNAL_ORIGIN_BUCKET, SKIP_SETUP } = process.env;

  if (!CURRENT_STACK_REGION || !CURRENT_STACK_NAME) {
    throw new Error('Required environment variables: CURRENT_STACK_REGION, CURRENT_STACK_NAME');
  }

  return {
    stackRegion: CURRENT_STACK_REGION,
    stackName: CURRENT_STACK_NAME,
    testBucket: TEST_BUCKET,
    externalOriginBucket: EXTERNAL_ORIGIN_BUCKET,
    skipSetup: SKIP_SETUP === 'true'
  };
}

async function setupBucket(client: S3Client | ExternalOriginClient, bucketProvided: boolean): Promise<void> {
  if (!bucketProvided) {
    await client.createBucket();
  }
  await client.uploadTestImages();
}

async function waitForHealthy(cloudFrontDomain: string, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`https://${cloudFrontDomain}/health`);
      if (response.ok) return;
    } catch (error) {
      // Ignore and retry
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('CloudFront distribution not healthy');
}

async function ensureTestImagesExist(): Promise<void> {
  const testImagesDir = join(__dirname, '../test-images');
  const requiredImages = ['test.jpg', 'test.png', 'test.gif', 'test.svg', 'test-animated.gif', 'test-solid.jpg'];

  const allExist = requiredImages.every(img => existsSync(join(testImagesDir, img)));

  if (!allExist) {
    console.log('Test images not found. Generating...');
    await generateTestImages();
  }
}

// Resolves the test bucket for skip mode, in priority order:
//   1. TEST_BUCKET env var (explicit override)
//   2. .e2e-state.json from a prior `test:e2e:up`
// Throws a clear, actionable error if neither is available.
function resolveSkipModeBucket(config: SetupConfig): { testBucket: string; bucketProvided: boolean; testRunId?: string } {
  if (config.testBucket) {
    return { testBucket: config.testBucket, bucketProvided: true };
  }

  const state = readState();
  if (state?.testBucket) {
    console.log(`Using bootstrapped bucket from .e2e-state.json: ${state.testBucket}`);
    return { testBucket: state.testBucket, bucketProvided: state.bucketProvided, testRunId: state.testRunId };
  }

  throw new Error(
    'SKIP_SETUP=true but no bucket available. Run `npm run test:e2e:up` to bootstrap, or set TEST_BUCKET.'
  );
}

/**
 * Shared setup routine used by both the jest globalSetup hook and the standalone
 * `test:e2e:up` bootstrap entrypoint. Returns the resolved state describing the
 * deployed resources the suite runs against.
 */
export async function runSetup(opts: RunSetupOptions): Promise<E2EState> {
  await ensureTestImagesExist();

  const config = validateAndLoadConfig();

  const cfnClient = new CfnClient(config.stackRegion);
  const stack = await cfnClient.readStackDetails(config.stackName, config.stackRegion);

  const ddbClient = new DynamoDBClient(stack.region, stack.configTableName);

  // Skip mode: discover the bucket (env > state) and verify it still exists before
  // running, so a redeployed/destroyed stack fails loudly instead of failing every test.
  let testBucket: string;
  let bucketProvided: boolean;
  let testRunId: string;

  if (!opts.seed) {
    const resolved = resolveSkipModeBucket(config);
    testBucket = resolved.testBucket;
    bucketProvided = resolved.bucketProvided;
    // Reuse the bootstrap's run ID from state; fall back to a fresh one only if absent
    // (e.g. bucket supplied via TEST_BUCKET with no state file).
    testRunId = resolved.testRunId ?? ddbClient.getTestRunId();
    const s3Client = new S3Client(stack.region, testBucket);
    if (!(await s3Client.bucketExists())) {
      throw new Error(
        `Bootstrapped bucket "${testBucket}" no longer exists. Re-run \`npm run test:e2e:up\`.`
      );
    }
  } else {
    bucketProvided = !!config.testBucket;
    const s3Client = new S3Client(stack.region, config.testBucket);
    await setupBucket(s3Client, bucketProvided);
    testBucket = s3Client.getBucketName();
    testRunId = ddbClient.getTestRunId();
  }

  process.env.TEST_BUCKET = testBucket;

  /*
    @TODO: Extend E2E test to use an external origin. Could be simulated with a across account S3 bucket. Included this for easy future extensibility.

  externalOriginClient = new ExternalOriginClient(stack.region);
  if (externalOriginBucketProvided) {
    externalOriginClient['bucketName'] = config.externalOriginBucket;
  }
  await setupBucket(externalOriginClient, externalOriginBucketProvided);
  const externalOriginUrl = externalOriginClient.getOriginUrl();
  */

  if (opts.seed) {
    await ddbClient.seedTestData();
    // await ddbClient.seedExternalOrigin(externalOriginUrl);

    console.log(`Waiting ${DDB_STREAM_BATCH_WINDOW_SECONDS}s for DDB stream batch window...`);
    await new Promise(resolve => setTimeout(resolve, DDB_STREAM_BATCH_WINDOW_SECONDS * 1000));

    const ecsClient = new EcsClient(stack.region);
    await ecsClient.waitForDeployment(ECS_CLUSTER_NAME, ECS_SERVICE_NAME, ECS_DEPLOYMENT_TIMEOUT_SECONDS);
  } else {
    console.log('Skipping DDB seeding and ECS deployment wait (using bootstrapped resources)');
  }

  await waitForHealthy(stack.cloudFrontDomain);

  const state: E2EState = {
    testBucket,
    bucketProvided,
    region: stack.region,
    stackName: stack.stackName,
    configTable: stack.configTableName,
    cloudFrontDomain: stack.cloudFrontDomain,
    testRunId
  };

  Object.assign(process.env, {
    CLOUDFRONT_DOMAIN: state.cloudFrontDomain,
    CONFIG_TABLE: state.configTable,
    TEST_BUCKET: state.testBucket,
    TEST_BUCKET_PROVIDED: state.bucketProvided.toString(),
    // EXTERNAL_ORIGIN_URL: externalOriginUrl,
    // EXTERNAL_ORIGIN_BUCKET: externalOriginClient.getBucketName(),
    // EXTERNAL_ORIGIN_BUCKET_PROVIDED: externalOriginBucketProvided.toString(),
    TEST_RUN_ID: state.testRunId
  });

  if (opts.persist) {
    writeState(state);
  }

  return state;
}

const globalSetup = async (): Promise<void> => {
  const skipSetup = process.env.SKIP_SETUP === 'true';
  // Jest hook never persists — persistence is the job of the `test:e2e:up` bootstrap.
  await runSetup({ seed: !skipSetup, persist: false });
};

export default globalSetup;
