// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionClient } from './rekognition-client';
import { RekognitionCacheDao } from './rekognition-cache-dao';
import { CacheGetRequest, CacheGetResult, RekognitionApiName, RekognitionClientResult } from './types';

export class RekognitionReadThroughCache {
  private dao: RekognitionCacheDao;
  private client: RekognitionClient;

  constructor(dao: RekognitionCacheDao, client: RekognitionClient) {
    this.dao = dao;
    this.client = client;
  }

  async get(request: CacheGetRequest): Promise<CacheGetResult> {
    const start = Date.now();

    try {
      const cached = await this.dao.get(request.imageBytes, request.apiName, request.customModelArn);
      if (cached) {
        return {
          result: cached,
          source: 'cache',
          latencyMs: Date.now() - start,
        };
      }
    } catch (error) {
      console.log(JSON.stringify({ component: 'RekognitionReadThroughCache', event: 'cache_read_error', apiName: request.apiName, error: (error as Error)?.message }));
    }

    const { detection, latencyMs } = await this.callRekognition(request);
    console.log(JSON.stringify({ component: 'RekognitionReadThroughCache', event: 'rekognition_call', apiName: request.apiName, latencyMs }));
    
    this.dao.put(request.imageBytes, request.apiName, detection, request.customModelArn)
      .catch((error) => {
        console.log(JSON.stringify({ component: 'RekognitionReadThroughCache', event: 'cache_write_error', apiName: request.apiName, error: (error as Error)?.message }));
      });
    return {
      result: detection,
      source: 'rekognition',
      latencyMs,
    };
  }

  async batchGet(requests: CacheGetRequest[]): Promise<Map<RekognitionApiName, CacheGetResult>> {
    const results = await Promise.allSettled(requests.map((r) => this.get(r)));
    const map = new Map<RekognitionApiName, CacheGetResult>();
    for (let i = 0; i < results.length; i++) {
      const settled = results[i];
      if (settled.status === 'fulfilled') {
        map.set(requests[i].apiName, settled.value);
      }
    }
    return map;
  }

  private async callRekognition(request: CacheGetRequest): Promise<RekognitionClientResult> {
    switch (request.apiName) {
      case 'DetectFaces': return this.client.detectFaces(request.imageBytes);
      case 'DetectLabels': return this.client.detectLabels(request.imageBytes);
      case 'DetectText': return this.client.detectText(request.imageBytes);
      case 'DetectModerationLabels': return this.client.detectModerationLabels(request.imageBytes);
      case 'DetectCustomLabels': return this.client.detectCustomLabels(request.imageBytes, request.customModelArn!);
    }
  }
}
