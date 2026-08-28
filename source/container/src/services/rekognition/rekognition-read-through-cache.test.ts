// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionReadThroughCache } from './rekognition-read-through-cache';
import { RekognitionCacheDao } from './rekognition-cache-dao';
import { RekognitionClient } from './rekognition-client';
import { CacheGetRequest, DetectionResult, RekognitionClientResult } from './types';

const imageBytes = Buffer.from('test-image');

const makeDetectionResult = (apiName: string): DetectionResult => ({
  apiName: apiName as DetectionResult['apiName'],
  boundingBoxes: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.4, label: 'Face', confidence: 99 }],
});

const makeClientResult = (apiName: string): RekognitionClientResult => ({
  detection: makeDetectionResult(apiName),
  latencyMs: 50,
});

const makeCachedDetection = (apiName: string): DetectionResult => makeDetectionResult(apiName);

const makeRequest = (apiName: string): CacheGetRequest => ({
  apiName: apiName as CacheGetRequest['apiName'],
  imageBytes,
});

describe('RekognitionReadThroughCache', () => {
  let mockDao: jest.Mocked<RekognitionCacheDao>;
  let mockClient: jest.Mocked<RekognitionClient>;
  let cache: RekognitionReadThroughCache;

  beforeEach(() => {
    mockDao = {
      get: jest.fn(),
      put: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RekognitionCacheDao>;

    mockClient = {
      detectFaces: jest.fn(),
      detectLabels: jest.fn(),
      detectText: jest.fn(),
      detectModerationLabels: jest.fn(),
      detectCustomLabels: jest.fn(),
    } as unknown as jest.Mocked<RekognitionClient>;

    cache = new RekognitionReadThroughCache(mockDao, mockClient);
  });

  describe('get', () => {
    it('should return cached result on hit without calling Rekognition', async () => {
      mockDao.get.mockResolvedValue(makeCachedDetection('DetectFaces'));

      const result = await cache.get(makeRequest('DetectFaces'));

      expect(result.source).toBe('cache');
      expect(result.result.apiName).toBe('DetectFaces');
      expect(mockClient.detectFaces).not.toHaveBeenCalled();
      expect(mockDao.put).not.toHaveBeenCalled();
    });

    it('should call Rekognition and write back on cache miss', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectFaces.mockResolvedValue(makeClientResult('DetectFaces'));

      const result = await cache.get(makeRequest('DetectFaces'));

      expect(result.source).toBe('rekognition');
      expect(result.result).toEqual(makeDetectionResult('DetectFaces'));
      expect(mockClient.detectFaces).toHaveBeenCalledWith(imageBytes);
      expect(mockDao.put).toHaveBeenCalledWith(imageBytes, 'DetectFaces', expect.anything(), undefined);
    });

    it('should route to correct Rekognition API method on miss', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectLabels.mockResolvedValue(makeClientResult('DetectLabels'));

      await cache.get(makeRequest('DetectLabels'));

      expect(mockClient.detectLabels).toHaveBeenCalledWith(imageBytes);
      expect(mockClient.detectFaces).not.toHaveBeenCalled();
    });

    it('should pass customModelArn for DetectCustomLabels', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectCustomLabels.mockResolvedValue(makeClientResult('DetectCustomLabels'));
      const request = { ...makeRequest('DetectCustomLabels'), customModelArn: 'arn:aws:rekognition:us-east-1:123:project/m/version/1' };

      await cache.get(request);

      expect(mockClient.detectCustomLabels).toHaveBeenCalledWith(imageBytes, request.customModelArn);
    });

    it('should not fail if write-back rejects', async () => {
      mockDao.get.mockResolvedValue(null);
      mockDao.put.mockRejectedValue(new Error('write failed'));
      mockClient.detectFaces.mockResolvedValue(makeClientResult('DetectFaces'));

      const result = await cache.get(makeRequest('DetectFaces'));

      expect(result.source).toBe('rekognition');
    });

    it('should propagate Rekognition errors on miss', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectFaces.mockRejectedValue(new Error('Rekognition timeout'));

      await expect(cache.get(makeRequest('DetectFaces'))).rejects.toThrow('Rekognition timeout');
    });

    it('should include customModelArn in dao calls for DetectCustomLabels', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectCustomLabels.mockResolvedValue(makeClientResult('DetectCustomLabels'));
      const request = { ...makeRequest('DetectCustomLabels'), customModelArn: 'arn:aws:rekognition:us-east-1:123:project/m/version/1' };

      await cache.get(request);

      expect(mockDao.get).toHaveBeenCalledWith(imageBytes, 'DetectCustomLabels', 'arn:aws:rekognition:us-east-1:123:project/m/version/1');
      expect(mockDao.put).toHaveBeenCalledWith(imageBytes, 'DetectCustomLabels', expect.anything(), 'arn:aws:rekognition:us-east-1:123:project/m/version/1');
    });

    it('should pass undefined customModelArn for non-custom-labels APIs', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectFaces.mockResolvedValue(makeClientResult('DetectFaces'));

      await cache.get(makeRequest('DetectFaces'));

      expect(mockDao.get).toHaveBeenCalledWith(imageBytes, 'DetectFaces', undefined);
    });
  });

  describe('batchGet', () => {
    it('should return results for all successful requests', async () => {
      mockDao.get
        .mockResolvedValueOnce(makeCachedDetection('DetectFaces'))
        .mockResolvedValueOnce(null);
      mockClient.detectLabels.mockResolvedValue(makeClientResult('DetectLabels'));

      const map = await cache.batchGet([makeRequest('DetectFaces'), makeRequest('DetectLabels')]);

      expect(map.size).toBe(2);
      expect(map.get('DetectFaces')!.source).toBe('cache');
      expect(map.get('DetectLabels')!.source).toBe('rekognition');
    });

    it('should exclude failed APIs without failing the batch', async () => {
      mockDao.get
        .mockResolvedValueOnce(makeCachedDetection('DetectFaces'))
        .mockResolvedValueOnce(null);
      mockClient.detectLabels.mockRejectedValue(new Error('API error'));

      const map = await cache.batchGet([makeRequest('DetectFaces'), makeRequest('DetectLabels')]);

      expect(map.size).toBe(1);
      expect(map.has('DetectFaces')).toBe(true);
      expect(map.has('DetectLabels')).toBe(false);
    });

    it('should return empty map when all requests fail', async () => {
      mockDao.get.mockResolvedValue(null);
      mockClient.detectFaces.mockRejectedValue(new Error('fail'));
      mockClient.detectLabels.mockRejectedValue(new Error('fail'));

      const map = await cache.batchGet([makeRequest('DetectFaces'), makeRequest('DetectLabels')]);

      expect(map.size).toBe(0);
    });

    it('should handle empty request array', async () => {
      const map = await cache.batchGet([]);

      expect(map.size).toBe(0);
    });
  });
});
