// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from './dynamodb-client';
import { ExternalOriginClient } from './external-origin-client';

const globalTeardown = async (): Promise<void> => {
  const { CURRENT_STACK_REGION, CONFIG_TABLE, TEST_BUCKET, EXTERNAL_ORIGIN_BUCKET, TEST_BUCKET_PROVIDED, EXTERNAL_ORIGIN_BUCKET_PROVIDED } = process.env;
  
  if (!CURRENT_STACK_REGION || !CONFIG_TABLE) {
    return;
  }
  
  const ddbClient = new DynamoDBClient(CURRENT_STACK_REGION, CONFIG_TABLE);
  await ddbClient.clearTestData();

  if (TEST_BUCKET && TEST_BUCKET_PROVIDED !== 'true') {
    const s3Client = new (await import('./s3-client')).S3Client(CURRENT_STACK_REGION, TEST_BUCKET);
    await s3Client.deleteBucket();
  }

  if (EXTERNAL_ORIGIN_BUCKET && EXTERNAL_ORIGIN_BUCKET_PROVIDED !== 'true') {
    const externalOrigin = new ExternalOriginClient(CURRENT_STACK_REGION);
    externalOrigin['bucketName'] = EXTERNAL_ORIGIN_BUCKET;
    await externalOrigin.deleteBucket();
  }
};

export default globalTeardown;
