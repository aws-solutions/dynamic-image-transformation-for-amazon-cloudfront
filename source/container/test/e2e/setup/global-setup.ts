// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnClient } from './cfn-client';
import { S3Client } from './s3-client';
import { ExternalOriginClient } from './external-origin-client';
import { DynamoDBClient } from './dynamodb-client';
import { EcsClient } from './ecs-client';
import { generateTestImages } from './generate-test-images';
import { existsSync } from 'fs';
import { join } from 'path';

const ECS_CLUSTER_NAME = 'dit-cluster';
const ECS_SERVICE_NAME = 'dit-service';
const DDB_STREAM_BATCH_WINDOW_SECONDS = 3 * 60;
const ECS_DEPLOYMENT_TIMEOUT_SECONDS = 10 * 60;

let externalOriginClient: ExternalOriginClient | null = null;

interface SetupConfig {
  stackRegion: string;
  stackName: string;
  testBucket?: string;
  externalOriginBucket?: string;
  skipSetup: boolean;
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
  const requiredImages = ['test.jpg', 'test.png', 'test.gif'];
  
  const allExist = requiredImages.every(img => existsSync(join(testImagesDir, img)));
  
  if (!allExist) {
    console.log('Test images not found. Generating...');
    await generateTestImages();
  }
}

const globalSetup = async (): Promise<void> => {
  await ensureTestImagesExist();
  
  const config = validateAndLoadConfig();
  
  const cfnClient = new CfnClient(config.stackRegion);
  const stack = await cfnClient.readStackDetails(config.stackName, config.stackRegion);
  
  const testBucketProvided = !!config.testBucket;
  const externalOriginBucketProvided = !!config.externalOriginBucket;
  
  const s3Client = new S3Client(stack.region, config.testBucket);
  await setupBucket(s3Client, testBucketProvided);
  
  /* 
    @TODO: Extend E2E test to use an external origin. Could be simulated with a across account S3 bucket. Included this for easy future extensibility.

  externalOriginClient = new ExternalOriginClient(stack.region);
  if (externalOriginBucketProvided) {
    externalOriginClient['bucketName'] = config.externalOriginBucket;
  }
  await setupBucket(externalOriginClient, externalOriginBucketProvided);
  const externalOriginUrl = externalOriginClient.getOriginUrl();
  */

  const testBucket = s3Client.getBucketName();
  process.env.TEST_BUCKET = testBucket;
  
  const ddbClient = new DynamoDBClient(stack.region, stack.configTableName);
  
  if (!config.skipSetup) {
    await ddbClient.seedTestData();
    // await ddbClient.seedExternalOrigin(externalOriginUrl);
    
    console.log(`Waiting ${DDB_STREAM_BATCH_WINDOW_SECONDS}s for DDB stream batch window...`);
    await new Promise(resolve => setTimeout(resolve, DDB_STREAM_BATCH_WINDOW_SECONDS * 1000));
    
    const ecsClient = new EcsClient(stack.region);
    await ecsClient.waitForDeployment(ECS_CLUSTER_NAME, ECS_SERVICE_NAME, ECS_DEPLOYMENT_TIMEOUT_SECONDS);
  } else {
    console.log('Skipping DDB seeding and ECS deployment wait (SKIP_SETUP=true)');
  }
  
  await waitForHealthy(stack.cloudFrontDomain);
  
  Object.assign(process.env, {
    CLOUDFRONT_DOMAIN: stack.cloudFrontDomain,
    CONFIG_TABLE: stack.configTableName,
    TEST_BUCKET: testBucket,
    TEST_BUCKET_PROVIDED: testBucketProvided.toString(),
    // EXTERNAL_ORIGIN_URL: externalOriginUrl,
    // EXTERNAL_ORIGIN_BUCKET: externalOriginClient.getBucketName(),
    // EXTERNAL_ORIGIN_BUCKET_PROVIDED: externalOriginBucketProvided.toString(),
    TEST_RUN_ID: ddbClient.getTestRunId()
  });
};

export default globalSetup;


