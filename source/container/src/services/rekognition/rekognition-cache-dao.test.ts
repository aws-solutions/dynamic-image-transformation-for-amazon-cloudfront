// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { RekognitionCacheDao } from './rekognition-cache-dao';

const ddbMock = mockClient(DynamoDBClient);
const imageBytes = Buffer.from('test-image');
const imageHash = '9febe01bd41bfb69683e29d711d8adffc9ae38de17a6873464b416f3b67398b6';

beforeEach(() => {
  ddbMock.reset();
  process.env.REKOGNITION_CACHE_TABLE = 'test-cache-table';
  process.env.REKOGNITION_CACHE_TTL = '3600';
});

afterEach(() => {
  delete process.env.REKOGNITION_CACHE_TABLE;
  delete process.env.REKOGNITION_CACHE_TTL;
});

describe('RekognitionCacheDao', () => {
  describe('get', () => {
    it('should return DetectionResult on hit', async () => {
      const stored = { pk: imageHash, sk: 'DetectFaces', result: { apiName: 'DetectFaces', boundingBoxes: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.4, confidence: 99 }] }, ttl: 9999999999, cachedAt: '2026-03-20T00:00:00.000Z' };
      ddbMock.on(GetItemCommand).resolves({ Item: marshall(stored) });

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      const result = await dao.get(imageBytes, 'DetectFaces');

      expect(result).toEqual({ apiName: 'DetectFaces', boundingBoxes: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.4, confidence: 99 }] });
    });

    it('should return null on cache miss', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      const result = await dao.get(imageBytes, 'DetectFaces');

      expect(result).toBeNull();
    });

    it('should return null when item TTL has expired', async () => {
      const expired = { pk: imageHash, sk: 'DetectFaces', result: { apiName: 'DetectFaces', boundingBoxes: [] }, ttl: Math.floor(Date.now() / 1000) - 1, cachedAt: '2026-03-20T00:00:00.000Z' };
      ddbMock.on(GetItemCommand).resolves({ Item: marshall(expired) });

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      const result = await dao.get(imageBytes, 'DetectFaces');

      expect(result).toBeNull();
    });

    it('should use SHA-256 content hash as partition key', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      await dao.get(imageBytes, 'DetectLabels');

      const call = ddbMock.commandCalls(GetItemCommand)[0];
      expect(call.args[0].input.TableName).toBe('test-cache-table');
      expect(call.args[0].input.Key).toEqual(marshall({ pk: imageHash, sk: 'DetectLabels' }));
    });

    it('should produce identical keys for identical content regardless of source', async () => {
      ddbMock.on(GetItemCommand).resolves({});
      const sharedBytes = Buffer.from('same-content');

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      await dao.get(sharedBytes, 'DetectFaces');
      await dao.get(sharedBytes, 'DetectFaces');

      const calls = ddbMock.commandCalls(GetItemCommand);
      expect(calls[0].args[0].input.Key).toEqual(calls[1].args[0].input.Key);
    });

    it('should produce different keys for different image content', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      await dao.get(Buffer.from('image-v1'), 'DetectFaces');
      await dao.get(Buffer.from('image-v2'), 'DetectFaces');

      const calls = ddbMock.commandCalls(GetItemCommand);
      const pk1 = calls[0].args[0].input.Key!.pk.S;
      const pk2 = calls[1].args[0].input.Key!.pk.S;
      expect(pk1).not.toEqual(pk2);
      expect(pk1).toMatch(/^[a-f0-9]{64}$/);
      expect(pk2).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should build composite sort key for DetectCustomLabels with customModelArn', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      await dao.get(imageBytes, 'DetectCustomLabels', 'arn:aws:rekognition:us-east-1:123:project/m/version/1');

      const call = ddbMock.commandCalls(GetItemCommand)[0];
      expect(call.args[0].input.Key).toEqual(marshall({ pk: imageHash, sk: 'DetectCustomLabels#arn:aws:rekognition:us-east-1:123:project/m/version/1' }));
    });

    it('should use plain apiName as sort key when no customModelArn', async () => {
      ddbMock.on(GetItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      await dao.get(imageBytes, 'DetectCustomLabels');

      const call = ddbMock.commandCalls(GetItemCommand)[0];
      expect(call.args[0].input.Key).toEqual(marshall({ pk: imageHash, sk: 'DetectCustomLabels' }));
    });
  });

  describe('put', () => {
    it('should write entry with content-hashed key, TTL, and timestamp', async () => {
      ddbMock.on(PutItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      const beforeSec = Math.floor(Date.now() / 1000);
      await dao.put(imageBytes, 'DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.4, confidence: 99 }] });
      const afterSec = Math.floor(Date.now() / 1000);

      const call = ddbMock.commandCalls(PutItemCommand)[0];
      expect(call.args[0].input.TableName).toBe('test-cache-table');

      const item = call.args[0].input.Item;
      expect(item.pk).toEqual({ S: imageHash });
      expect(item.sk).toEqual({ S: 'DetectFaces' });

      const ttl = parseInt(item.ttl.N, 10);
      expect(ttl).toBeGreaterThanOrEqual(beforeSec + 3600);
      expect(ttl).toBeLessThanOrEqual(afterSec + 3600);

      expect(item.cachedAt).toHaveProperty('S');
      expect(new Date(item.cachedAt.S).getTime()).not.toBeNaN();
    });

    it('should use default TTL of 86400 when env var is not set', async () => {
      delete process.env.REKOGNITION_CACHE_TTL;
      ddbMock.on(PutItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      const beforeSec = Math.floor(Date.now() / 1000);
      await dao.put(imageBytes, 'DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [] });

      const call = ddbMock.commandCalls(PutItemCommand)[0];
      const ttl = parseInt(call.args[0].input.Item.ttl.N, 10);
      expect(ttl).toBeGreaterThanOrEqual(beforeSec + 86400);
      expect(ttl).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 86400);
    });

    it('should build composite sort key for DetectCustomLabels with customModelArn', async () => {
      ddbMock.on(PutItemCommand).resolves({});

      const dao = new RekognitionCacheDao(new DynamoDBClient({}));
      await dao.put(imageBytes, 'DetectCustomLabels', { apiName: 'DetectCustomLabels', boundingBoxes: [] }, 'arn:aws:rekognition:us-east-1:123:project/m/version/1');

      const call = ddbMock.commandCalls(PutItemCommand)[0];
      expect(call.args[0].input.Item.sk).toEqual({ S: 'DetectCustomLabels#arn:aws:rekognition:us-east-1:123:project/m/version/1' });
    });
  });
});
