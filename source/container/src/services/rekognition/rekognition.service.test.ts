// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionService } from './rekognition.service';
import { RekognitionReadThroughCache } from './rekognition-read-through-cache';
import { CacheGetResult, DetectionResult, RekognitionApiName, TargetResolutionRequest } from './types';

const imageBytes = Buffer.from('test-image');

const makeDetection = (apiName: RekognitionApiName): DetectionResult => ({
  apiName,
  boundingBoxes: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.4, label: 'Face', confidence: 99 }],
});

const makeCacheResult = (apiName: RekognitionApiName, source: 'cache' | 'rekognition'): CacheGetResult => ({
  result: makeDetection(apiName),
  source,
  latencyMs: source === 'cache' ? 5 : 200,
});

const makeRequest = (apis: RekognitionApiName[], customModelArn?: string): TargetResolutionRequest => ({
  imageBytes,
  requiredApis: apis,
  customModelArn,
});

describe('RekognitionService', () => {
  let mockCache: jest.Mocked<RekognitionReadThroughCache>;
  let service: RekognitionService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCache = { get: jest.fn(), batchGet: jest.fn() } as unknown as jest.Mocked<RekognitionReadThroughCache>;
    service = new RekognitionService(mockCache);
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should return detections map for all cache hits', async () => {
    mockCache.batchGet.mockResolvedValue(
      new Map([
        ['DetectFaces', makeCacheResult('DetectFaces', 'cache')],
        ['DetectLabels', makeCacheResult('DetectLabels', 'cache')],
      ])
    );

    const result = await service.detectTargets(makeRequest(['DetectFaces', 'DetectLabels']));

    expect(result.size).toBe(2);
    expect(result.get('DetectFaces')).toEqual(makeDetection('DetectFaces'));
    expect(result.get('DetectLabels')).toEqual(makeDetection('DetectLabels'));
  });

  it('should log cache metrics with hits, misses, and errors', async () => {
    mockCache.batchGet.mockResolvedValue(
      new Map([
        ['DetectFaces', makeCacheResult('DetectFaces', 'cache')],
        ['DetectText', makeCacheResult('DetectText', 'rekognition')],
      ])
    );

    await service.detectTargets(makeRequest(['DetectFaces', 'DetectLabels', 'DetectText']));

    const logged = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logged.component).toBe('RekognitionService');
    expect(logged.hits).toEqual(['DetectFaces']);
    expect(logged.misses).toEqual(['DetectText']);
    expect(logged.errors).toEqual(['DetectLabels']);
    expect(logged.rekognitionLatencyMs.DetectText).toBe(200);
  });

  it('should pass customModelArn only for DetectCustomLabels', async () => {
    mockCache.batchGet.mockResolvedValue(new Map());
    const arn = 'arn:aws:rekognition:us-east-1:123:project/m/version/1';

    await service.detectTargets(makeRequest(['DetectFaces', 'DetectCustomLabels'], arn));

    const requests = mockCache.batchGet.mock.calls[0][0];
    expect(requests[0].customModelArn).toBeUndefined();
    expect(requests[1].customModelArn).toBe(arn);
  });

  it('should return empty map when all APIs fail', async () => {
    mockCache.batchGet.mockResolvedValue(new Map());

    const result = await service.detectTargets(makeRequest(['DetectFaces', 'DetectLabels']));

    expect(result.size).toBe(0);
  });

  it('should handle empty requiredApis', async () => {
    mockCache.batchGet.mockResolvedValue(new Map());

    const result = await service.detectTargets(makeRequest([]));

    expect(result.size).toBe(0);
  });
});
