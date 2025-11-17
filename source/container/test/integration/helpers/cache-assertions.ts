// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PolicyCache } from '../../../src/services/cache/domain/policy-cache';
import { OriginCache } from '../../../src/services/cache/domain/origin-cache';
import { PathMappingCache } from '../../../src/services/cache/domain/path-mapping-cache';
import { HeaderMappingCache } from '../../../src/services/cache/domain/header-mapping-cache';

export class CacheAssertions {
  static async verifyPolicyCachePopulated(cache: PolicyCache): Promise<void> {
    // Check cache contents directly without triggering fallback population
    const cacheContents = await cache.getContents();
    const resizePolicy = cacheContents.find(p => p.policyId === 'resize-policy');
    const cropPolicy = cacheContents.find(p => p.policyId === 'crop-policy');
    
    expect(resizePolicy).toBeDefined();
    expect(resizePolicy?.transformations).toBeDefined();
    expect(resizePolicy?.transformations.some(t => t.type === 'width' || t.type === 'height')).toBe(true);
    
    expect(cropPolicy).toBeDefined();
    expect(cropPolicy?.transformations).toBeDefined();
    expect(cropPolicy?.transformations.some(t => t.type === 'fit')).toBe(true);
    expect(cropPolicy?.transformations.some(t => t.value === 'cover')).toBe(true);
  }

  static async verifyOriginCachePopulated(cache: OriginCache): Promise<void> {
    // Check cache contents directly without triggering fallback population
    const cacheContents = await cache.getContents();
    const bucket1Origin = cacheContents.find(o => o.originId === 'bucket1');
    const external1Origin = cacheContents.find(o => o.originId === 'external1');
    
    expect(bucket1Origin).toBeDefined();
    expect(bucket1Origin?.originDomain).toBe('https://test-bucket-1.s3.amazonaws.com');
    
    expect(external1Origin).toBeDefined();
    expect(external1Origin?.originDomain).toBe('https://example.com');
  }

  static async verifyPathMappingCachePopulated(cache: PathMappingCache): Promise<void> {
    // Check cache contents directly without triggering fallback population
    const cacheContents = await cache.getContents();
    const imagesMapping = cacheContents.find(m => m.pathPattern === '/images/*');
    const externalMapping = cacheContents.find(m => m.pathPattern === '/external/*');
    
    expect(imagesMapping).toBeDefined();
    expect(imagesMapping?.originId).toBe('bucket1');
    
    expect(externalMapping).toBeDefined();
    expect(externalMapping?.originId).toBe('external1');
  }

  static async verifyHeaderMappingCachePopulated(cache: HeaderMappingCache): Promise<void> {
    // Check cache contents directly without triggering fallback population
    const cacheContents = await cache.getContents();
    const headerMapping = cacheContents.find(h => h.hostPattern === 'cdn.example.com');
    
    expect(headerMapping).toBeDefined();
    expect(headerMapping?.originId).toBe('bucket1');
  }

  static async verifyCachesEmpty(
    policyCache: PolicyCache,
    originCache: OriginCache,
    pathMappingCache: PathMappingCache,
    headerMappingCache: HeaderMappingCache
  ): Promise<void> {
    expect(await policyCache.size()).toBe(0);
    expect(await originCache.size()).toBe(0);
    expect(await pathMappingCache.size()).toBe(0);
    expect(await headerMappingCache.size()).toBe(0);
  }
}