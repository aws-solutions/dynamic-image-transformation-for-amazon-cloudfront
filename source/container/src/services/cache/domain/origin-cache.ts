// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CacheManager } from '../interfaces/cache-manager';
import { KeyValueCache } from '../implementations/key-value-cache';
import { ORIGIN_CACHE_CONFIG } from '../config/cache-defaults';
import { getCacheKey } from '../utils/simplified-cache-key';
import { DDBDriver } from '../../database/ddb-driver.interface';
import { ddbDriver } from '../../database';

/**
 * Origin cache manager with transparent DynamoDB fallback.
 * Handles caching of origin configurations for HTTP-accessible image sources.
 */
export class OriginCache {
  private cache: CacheManager<OriginConfiguration>;
  private ddbDriver: DDBDriver;

  constructor() {
    this.cache = new KeyValueCache<OriginConfiguration>(ORIGIN_CACHE_CONFIG);
    this.ddbDriver = ddbDriver.instance;
  }

  /**
   * Get origin configuration by ID from cache only
   */
  async getOrigin(originId: string): Promise<OriginConfiguration | null> {
    const cacheKey = getCacheKey(originId);
    return await this.cache.get(cacheKey);
  }

  /**
   * Manually cache an origin configuration
   */
  async cacheOrigin(origin: OriginConfiguration): Promise<void> {
    const cacheKey = getCacheKey(origin.originId);
    await this.cache.set(cacheKey, origin);
  }

  /**
   * Remove origin from cache
   */
  async invalidateOrigin(originId: string): Promise<void> {
    const cacheKey = getCacheKey(originId);
    await this.cache.delete(cacheKey);
  }

  async getContents(): Promise<OriginConfiguration[]> {
    return await this.cache.getAll();
  }

  async size(): Promise<number> {
    return await this.cache.size();
  }

  async warmCache(): Promise<void> {
    const origins = await this.ddbDriver.getAllOrigins();
    for (const origin of origins) {
      await this.cacheOrigin(origin);
    }
  }


}

/**
 * Origin configuration for HTTP-accessible image sources
 */
export interface OriginConfiguration {
  originId: string;
  originName: string;
  originDomain: string;
  originPath?: string;
  originHeaders?: Record<string, string>;
}
