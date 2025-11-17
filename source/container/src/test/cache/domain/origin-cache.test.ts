// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginCache } from '../../../services/cache/domain/origin-cache';
import { DDBDriver } from '../../../services/database/ddb-driver.interface';
import { createMockOrigin } from '../__mocks__/test-fixtures';

// Mock the database module
jest.mock('../../../services/database', () => ({
  ddbDriver: {
    instance: {}
  }
}));

describe('OriginCache', () => {
  let originCache: OriginCache;
  
  const testOriginId = 'test-origin-1';
  const testOrigin = createMockOrigin({ originId: testOriginId });

  beforeEach(() => {
    jest.clearAllMocks();
    originCache = new OriginCache();
  });

  describe('getOrigin', () => {
    it('should return null when origin not found in cache', async () => {
      const result = await originCache.getOrigin(testOriginId);
      expect(result).toBeNull();
    });

    it('should return origin when found in cache', async () => {
      // Pre-populate cache
      await originCache.cacheOrigin(testOrigin);
      
      const result = await originCache.getOrigin(testOriginId);
      expect(result).toEqual(testOrigin);
    });
  });

  describe('cacheOrigin', () => {
    it('should manually cache an origin', async () => {
      await originCache.cacheOrigin(testOrigin);
      // No assertions needed as this is a void method
    });
  });

  describe('invalidateOrigin', () => {
    it('should remove origin from cache', async () => {
      // First, populate the cache
      await originCache.cacheOrigin(testOrigin);
      let result = await originCache.getOrigin(testOriginId);
      expect(result).toEqual(testOrigin);
      
      // Invalidate the cache
      await originCache.invalidateOrigin(testOriginId);
      
      // Verify origin is no longer in cache
      result = await originCache.getOrigin(testOriginId);
      expect(result).toBeNull();
    });
  });

  describe('cacheOrigin', () => {
    it('should manually cache an origin', async () => {
      await originCache.cacheOrigin(testOrigin);
      
      const result = await originCache.getOrigin(testOriginId);
      expect(result).toEqual(testOrigin);
    });
  });
});
