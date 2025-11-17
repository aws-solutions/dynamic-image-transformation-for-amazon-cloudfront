// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PolicyCache } from './domain/policy-cache';
import { OriginCache } from './domain/origin-cache';
import { PathMappingCache } from './domain/path-mapping-cache';
import { HeaderMappingCache } from './domain/header-mapping-cache';

export class CacheRegistry {
  private static instance: CacheRegistry;
  private caches = new Map<string, any>();
  
  private constructor() {}
  
  static getInstance(): CacheRegistry {
    if (!CacheRegistry.instance) {
      CacheRegistry.instance = new CacheRegistry();
    }
    return CacheRegistry.instance;
  }

  getPolicyCache(): PolicyCache {
    return this.getCache<PolicyCache>('policy');
  }

  getOriginCache(): OriginCache {
    return this.getCache<OriginCache>('origin');
  }

  getPathMappingCache(): PathMappingCache {
    return this.getCache<PathMappingCache>('pathMapping');
  }

  getHeaderMappingCache(): HeaderMappingCache {
    return this.getCache<HeaderMappingCache>('headerMapping');
  }

  register<T>(name: string, cache: T): void {
    this.caches.set(name, cache);
  }

  get<T>(name: string): T | undefined {
    return this.caches.get(name) as T;
  }

  clear(): void {
    this.caches.clear();
  }

  private getCache<T>(name: string): T {
    const cache = this.caches.get(name);
    if (!cache) {
      throw new Error(`Cache ${name} not found`);
    }
    return cache as T;
  }
}