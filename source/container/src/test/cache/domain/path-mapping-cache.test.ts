// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PathMappingCache, PathMapping } from '../../../services/cache/domain/path-mapping-cache';
import { DDBDriver } from '../../../services/database/ddb-driver.interface';
import { mockPathMapping } from '../__mocks__/test-fixtures';

// Mock the database module
jest.mock('../../../services/database', () => ({
  ddbDriver: {
    instance: {}
  }
}));

describe('PathMappingCache', () => {
  let pathMappingCache: PathMappingCache;
  
  const testPath = '/images/products';
  const testPathMapping = mockPathMapping;

  beforeEach(() => {
    jest.clearAllMocks();
    pathMappingCache = new PathMappingCache();
  });

  describe('findBestMatch', () => {
    it('should return null when path mapping not found in cache', async () => {
      const result = await pathMappingCache.findBestMatch(testPath);
      expect(result).toBeNull();
    });

    it('should return path mapping when found in cache', async () => {
      // Pre-populate cache
      await pathMappingCache.cachePathMapping(testPathMapping);
      
      const result = await pathMappingCache.findBestMatch(testPathMapping.pathPattern);
      expect(result).toEqual(testPathMapping);
    });
  });

  describe('cache management', () => {
    it('should manually cache path mapping', async () => {
      await expect(pathMappingCache.cachePathMapping(testPathMapping)).resolves.not.toThrow();
    });
  });

  describe('invalidatePathMapping', () => {
    it('should remove path mapping from cache', async () => {
      // First, populate the cache
      await pathMappingCache.cachePathMapping(testPathMapping);
      let result = await pathMappingCache.findBestMatch(testPathMapping.pathPattern);
      expect(result).toEqual(testPathMapping);
      
      // Invalidate the cache
      await pathMappingCache.invalidatePathMapping(testPathMapping.pathPattern);
      
      // Verify mapping is no longer in cache
      result = await pathMappingCache.findBestMatch(testPathMapping.pathPattern);
      expect(result).toBeNull();
    });
  });

  describe('bulkCachePathMappings', () => {
    it('should cache multiple path mappings', async () => {
      const mappings = [testPathMapping, { pathPattern: '/api/*', originId: 'origin-2', policyId: 'policy-2' }];
      
      await pathMappingCache.bulkCachePathMappings(mappings);
      
      const result1 = await pathMappingCache.findBestMatch(testPathMapping.pathPattern);
      const result2 = await pathMappingCache.findBestMatch('/api/test');
      
      expect(result1).toEqual(testPathMapping);
      expect(result2).toEqual(mappings[1]);
    });
  });
});