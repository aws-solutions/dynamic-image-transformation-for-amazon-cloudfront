// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionReadThroughCache } from './rekognition-read-through-cache';
import { CacheGetRequest, DetectionResult, RekognitionApiName, TargetResolutionRequest } from './types';

export class RekognitionService {
  private cache: RekognitionReadThroughCache;

  constructor(cache: RekognitionReadThroughCache) {
    this.cache = cache;
  }

  async detectTargets(request: TargetResolutionRequest): Promise<Map<RekognitionApiName, DetectionResult>> {
    const cacheRequests: CacheGetRequest[] = request.requiredApis.map((apiName) => ({
      apiName,
      imageBytes: request.imageBytes,
      customModelArn: apiName === 'DetectCustomLabels' ? request.customModelArn : undefined,
    }));

    const results = await this.cache.batchGet(cacheRequests);

    const hits: RekognitionApiName[] = [];
    const misses: RekognitionApiName[] = [];
    const errors: RekognitionApiName[] = [];
    const rekognitionLatencyMs: Record<string, number> = {};

    for (const apiName of request.requiredApis) {
      const result = results.get(apiName);
      if (!result) {
        errors.push(apiName);
      } else if (result.source === 'cache') {
        hits.push(apiName);
      } else {
        misses.push(apiName);
        rekognitionLatencyMs[apiName] = result.latencyMs;
      }
    }

    console.log(JSON.stringify({ component: 'RekognitionService', event: 'detectTargets', apis: request.requiredApis, hits, misses, errors, rekognitionLatencyMs }));

    return new Map([...results.entries()].map(([apiName, r]) => [apiName, r.result]));
  }
}
