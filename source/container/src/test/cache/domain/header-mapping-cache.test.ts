// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { HeaderMappingCache } from '../../../services/cache/domain/header-mapping-cache';
import { DDBDriver } from '../../../services/database/ddb-driver.interface';
import { createMockHeaderMapping } from '../__mocks__/test-fixtures';

// Mock the database module
jest.mock('../../../services/database', () => ({
  ddbDriver: {
    instance: {}
  }
}));

describe('HeaderMappingCache', () => {
  let headerMappingCache: HeaderMappingCache;
  
  const testHostPattern = 'api.example.com';
  const testHeaderMapping = createMockHeaderMapping({ hostPattern: testHostPattern });

  beforeEach(() => {
    jest.clearAllMocks();
    headerMappingCache = new HeaderMappingCache();
  });

  describe('findBestMatch', () => {
    it('should return null for empty or invalid host headers', async () => {
      expect(await headerMappingCache.findBestMatch('')).toBeNull();
      expect(await headerMappingCache.findBestMatch('   ')).toBeNull();
    });

    it('should return null when header mapping not found in cache', async () => {
      const result = await headerMappingCache.findBestMatch(testHostPattern);
      expect(result).toBeNull();
    });

    it('should return header mapping when found in cache', async () => {
      // Pre-populate cache
      await headerMappingCache.cacheHeaderMapping(testHeaderMapping);
      
      const result = await headerMappingCache.findBestMatch(testHostPattern);
      expect(result).toEqual(testHeaderMapping);
    });
  });

  describe('cache management', () => {
    it('should manually cache header mapping', async () => {
      await expect(headerMappingCache.cacheHeaderMapping(testHeaderMapping)).resolves.not.toThrow();
    });
  });

  describe('invalidateHeaderMapping', () => {
    it('should remove header mapping from cache', async () => {
      // First, populate the cache
      await headerMappingCache.cacheHeaderMapping(testHeaderMapping);
      let result = await headerMappingCache.findBestMatch(testHostPattern);
      expect(result).toEqual(testHeaderMapping);
      
      // Invalidate the cache
      await headerMappingCache.invalidateHeaderMapping(testHostPattern);
      
      // Verify mapping is no longer in cache
      result = await headerMappingCache.findBestMatch(testHostPattern);
      expect(result).toBeNull();
    });
  });
});