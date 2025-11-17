// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getCacheKey, getPathCacheKey } from '../../../services/cache/utils/simplified-cache-key';

describe('SimplifiedCacheKey', () => {
  describe('getCacheKey', () => {
    it('should return entity ID as cache key', () => {
      const key = getCacheKey('policy-123');
      expect(key).toBe('policy-123');
    });
  });

  describe('getPathCacheKey', () => {
    it('should normalize path for cache key', () => {
      const key = getPathCacheKey('/Images/Products');
      expect(key).toBe('images/products');
    });

    it('should handle root path', () => {
      const key = getPathCacheKey('/');
      expect(key).toBe('');
    });

    it('should normalize multiple slashes', () => {
      const key = getPathCacheKey('//api//v1//images');
      expect(key).toBe('api/v1/images');
    });

    it('should remove trailing slash', () => {
      const key = getPathCacheKey('/api/v1/images/');
      expect(key).toBe('api/v1/images');
    });

    it('should convert to lowercase', () => {
      const key = getPathCacheKey('/API/V1/Images');
      expect(key).toBe('api/v1/images');
    });
  });
});