// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Generic cache manager interface for DIT caching system.
 * Provides abstraction layer for different cache implementations (in-memory, Redis, etc.)
 */
export interface CacheManager<T> {
  /**
   * Retrieve item from cache
   * @param key - Cache key identifier
   * @returns Promise resolving to cached item or null if not found
   */
  get(key: string): Promise<T | null>;

  /**
   * Store item in cache
   * @param key - Cache key identifier
   * @param value - Item to cache
   */
  set(key: string, value: T): Promise<void>;

  /**
   * Remove item from cache
   * @param key - Cache key identifier
   * @returns Promise resolving to true if item was deleted, false if not found
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all items from cache
   */
  clear(): Promise<void>;

  /**
   * Check if item exists in cache (does not trigger DynamoDB lookup)
   * @param key - Cache key identifier
   */
  has(key: string): Promise<boolean>;



  /**
   * Get current number of items in cache
   */
  size(): Promise<number>;

  /**
   * Get all cached items
   */
  getAll(): Promise<T[]>;
}
