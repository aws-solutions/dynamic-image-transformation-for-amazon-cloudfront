// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrieCache } from '../implementations/trie-cache';
import { PATH_MAPPING_CACHE_CONFIG } from '../config/cache-defaults';
import { getPathCacheKey } from '../utils/simplified-cache-key';
import { DDBDriver } from '../../database/ddb-driver.interface';
import { ddbDriver } from '../../database';

/**
 * Path mapping cache manager with transparent DynamoDB fallback.
 * Uses trie structure for efficient hierarchical path-based lookups.
 * Handles caching of path-to-policy/origin mappings for request routing.
 */
export class PathMappingCache {
  private cache: TrieCache<PathMapping>;
  private ddbDriver: DDBDriver;

  constructor() {
    this.cache = new TrieCache<PathMapping>(PATH_MAPPING_CACHE_CONFIG);
    this.ddbDriver = ddbDriver.instance;
  }

  /**
   * Find the best matching path mapping using longest prefix matching
   * This is the primary method for request routing
   */
  async findBestMatch(requestPath: string): Promise<PathMapping | null> {
    return await this.cache.findLongestPrefix(requestPath);
  }

  /**
   * Manually cache a path mapping
   */
  async cachePathMapping(mapping: PathMapping): Promise<void> {
    const cacheKey = getPathCacheKey(mapping.pathPattern);
    await this.cache.set(cacheKey, mapping);
  }

  /**
   * Remove path mapping from cache
   */
  async invalidatePathMapping(pathPattern: string): Promise<void> {
    const cacheKey = getPathCacheKey(pathPattern);
    await this.cache.delete(cacheKey);
  }

  /**
   * Bulk cache path mappings (useful for warming cache)
   */
  async bulkCachePathMappings(mappings: PathMapping[]): Promise<void> {
    for (const mapping of mappings) {
      await this.cachePathMapping(mapping);
    }
  }

  async getContents(): Promise<PathMapping[]> {
    return await this.cache.getAll();
  }

  async size(): Promise<number> {
    return await this.cache.size();
  }

  async warmCache(): Promise<void> {
    const mappings = await this.ddbDriver.getAllPathMappings();
    for (const mapping of mappings) {
      await this.cachePathMapping(mapping);
    }
  }


}

/**
 * Path mapping configuration for request routing
 */
export interface PathMapping {
  pathPattern: string;
  originId: string;
  policyId?: string;
}
