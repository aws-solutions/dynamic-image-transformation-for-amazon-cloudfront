// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CacheManager } from '../interfaces/cache-manager';
import { CacheConfig } from '../config/cache-defaults';

/**
 * In-memory key-value cache implementation using Map.
 * Optimized for transformation policies & origins
 */
export class KeyValueCache<T> implements CacheManager<T> {
  private cache = new Map<string, CacheItem<T>>();
  private readonly config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async get(key: string): Promise<T | null> {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    return item.value;
  }

  async set(key: string, value: T): Promise<void> {
    const item: CacheItem<T> = {
      value
    };

    this.cache.set(key, item);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async getAll(): Promise<T[]> {
    return Array.from(this.cache.values()).map(item => item.value);
  }
}

/**
 * Cache entry wrapper where T represents the domain entity (TransformationPolicy or OriginConfiguration)
 */
interface CacheItem<T> {
  value: T;
}
