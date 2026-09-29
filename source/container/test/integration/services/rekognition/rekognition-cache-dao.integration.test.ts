// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { RekognitionCacheDao } from '../../../../src/services/rekognition/rekognition-cache-dao';
import { DetectionResult } from '../../../../src/services/rekognition/types';

const TABLE_NAME = 'rekognition-cache-test';
const ENDPOINT = 'http://localhost:8000';

const ddbClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'local-env',
  credentials: { accessKeyId: 'fakeKey', secretAccessKey: 'fakeSecret' },
});

const imageBytes = Buffer.from('test-image-bytes');
const imageBytes2 = Buffer.from('different-image');

const faceResult: DetectionResult = {
  apiName: 'DetectFaces',
  boundingBoxes: [
    { left: 0.123456789, top: 0.987654321, width: 0.25, height: 0.333, label: 'Face', confidence: 99.5 },
    { left: 0.5, top: 0.5, width: 0.1, height: 0.15, label: 'Face', confidence: 87.123 },
  ],
};

const labelResult: DetectionResult = {
  apiName: 'DetectLabels',
  boundingBoxes: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.4, label: 'Cat', confidence: 92 }],
};

const createTable = async () => {
  try { await ddbClient.send(new DeleteTableCommand({ TableName: TABLE_NAME })); } catch { /* ignore */ }
  await ddbClient.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }));
};

describe('RekognitionCacheDao Integration (DynamoDB Local)', () => {
  let dao: RekognitionCacheDao;

  beforeAll(async () => {
    process.env.REKOGNITION_CACHE_TABLE = TABLE_NAME;
    process.env.REKOGNITION_CACHE_TTL = '86400';
    await createTable();
    dao = new RekognitionCacheDao(ddbClient);
  });

  afterAll(() => {
    delete process.env.REKOGNITION_CACHE_TABLE;
    delete process.env.REKOGNITION_CACHE_TTL;
  });

  test('1. Write then read — round-trip preserves DetectionResult', async () => {
    await dao.put(imageBytes, 'DetectFaces', faceResult);
    const result = await dao.get(imageBytes, 'DetectFaces');

    expect(result).toEqual(faceResult);
  });

  test('2. Cache miss — non-existent key returns null', async () => {
    const result = await dao.get(imageBytes2, 'DetectLabels');

    expect(result).toBeNull();
  });

  test('3. TTL expiry — expired entry returns null', async () => {
    // Create a DAO with 1-second TTL
    process.env.REKOGNITION_CACHE_TTL = '1';
    const shortTtlDao = new RekognitionCacheDao(ddbClient);

    await shortTtlDao.put(imageBytes2, 'DetectFaces', faceResult);

    // Immediately should be a hit
    const immediate = await shortTtlDao.get(imageBytes2, 'DetectFaces');
    expect(immediate).toEqual(faceResult);

    // Wait for TTL to expire (DAO checks ttl <= now)
    await new Promise((r) => setTimeout(r, 1500));
    const expired = await shortTtlDao.get(imageBytes2, 'DetectFaces');
    expect(expired).toBeNull();

    // Restore
    process.env.REKOGNITION_CACHE_TTL = '86400';
  });

  test('4. Custom model ARN sort key — different ARNs are separate entries', async () => {
    const arn1 = 'arn:aws:rekognition:us-east-1:123:project/model-a/version/1';
    const arn2 = 'arn:aws:rekognition:us-east-1:123:project/model-b/version/1';

    await dao.put(imageBytes, 'DetectCustomLabels', labelResult, arn1);

    const hit = await dao.get(imageBytes, 'DetectCustomLabels', arn1);
    expect(hit).toEqual(labelResult);

    const miss = await dao.get(imageBytes, 'DetectCustomLabels', arn2);
    expect(miss).toBeNull();
  });

  test('5. Overwrite — second put replaces first', async () => {
    await dao.put(imageBytes, 'DetectLabels', labelResult);
    const updated: DetectionResult = { apiName: 'DetectLabels', boundingBoxes: [] };
    await dao.put(imageBytes, 'DetectLabels', updated);

    const result = await dao.get(imageBytes, 'DetectLabels');
    expect(result).toEqual(updated);
  });

  test('6. Float precision — bounding box floats survive marshall/unmarshall', async () => {
    const preciseResult: DetectionResult = {
      apiName: 'DetectFaces',
      boundingBoxes: [{
        left: 0.123456789,
        top: 0.987654321,
        width: 0.111111111,
        height: 0.999999999,
        label: 'Face',
        confidence: 99.12345,
      }],
    };

    await dao.put(Buffer.from('precision-test'), 'DetectFaces', preciseResult);
    const result = await dao.get(Buffer.from('precision-test'), 'DetectFaces');

    expect(result!.boundingBoxes[0].left).toBe(0.123456789);
    expect(result!.boundingBoxes[0].top).toBe(0.987654321);
    expect(result!.boundingBoxes[0].confidence).toBe(99.12345);
  });
});
