// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrieCache } from '../implementations/trie-cache';
import { HEADER_MAPPING_CACHE_CONFIG } from '../config/cache-defaults';
import { getCacheKey } from '../utils/simplified-cache-key';
import { DDBDriver } from '../../database/ddb-driver.interface';
import { ddbDriver } from '../../database';

/**
 * Host-header mapping cache manager with transparent DynamoDB fallback.
 * Uses trie structure for efficient hierarchical host-based lookups.
 * Handles caching of host header to origin mappings.
 */
export class HeaderMappingCache {
  private cache: TrieCache<HeaderMapping>;
  private ddbDriver: DDBDriver;

  constructor() {
    this.cache = new TrieCache<HeaderMapping>(HEADER_MAPPING_CACHE_CONFIG);
    this.ddbDriver = ddbDriver.instance;
  }

  /**
   * Find the best matching header mapping using longest prefix matching
   * This is the primary method for host-based origin resolution
   */
  async findBestMatch(hostHeader: string): Promise<HeaderMapping | null> {
    if (!hostHeader || hostHeader.trim() === '') {
      return null;
    }
    return await this.cache.findLongestPrefix(hostHeader);
  }

  /**
   * Manually cache a header mapping
   */
  async cacheHeaderMapping(mapping: HeaderMapping): Promise<void> {
    const cacheKey = getCacheKey(mapping.hostPattern);
    await this.cache.set(cacheKey, mapping);
  }

  /**
   * Remove header mapping from cache
   */
  async invalidateHeaderMapping(hostPattern: string): Promise<void> {
    const cacheKey = getCacheKey(hostPattern);
    await this.cache.delete(cacheKey);
  }

  async getContents(): Promise<HeaderMapping[]> {
    return await this.cache.getAll();
  }

  async size(): Promise<number> {
    return await this.cache.size();
  }

  async warmCache(): Promise<void> {
    const mappings = await this.ddbDriver.getAllHeaderMappings();
    for (const mapping of mappings) {
      await this.cacheHeaderMapping(mapping);
    }
  }


}

/**
 * Host-Header-Origin mapping configuration
 */
export interface HeaderMapping {
  hostPattern: string;
  originId: string;
  policyId?: string;
}
