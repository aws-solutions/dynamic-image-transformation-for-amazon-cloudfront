// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TrieCache } from '../../../services/cache/implementations/trie-cache';
import { createMockPathMapping } from '../__mocks__/test-fixtures';

describe('TrieCache', () => {
  let cache: TrieCache<any>;
  const testValue = createMockPathMapping();

  beforeEach(() => {
    cache = new TrieCache<any>({
      name: 'test-trie-cache',
      maxDepth: 10,
      pathSeparator: '/',
      allowPrefixMatching: true
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve values by exact path', async () => {
      const path = '/images/products';
      await cache.set(path, testValue);
      
      const result = await cache.get(path);
      expect(result).toEqual(testValue);
    });

    it('should return null for non-existent paths', async () => {
      const result = await cache.get('/non/existent/path');
      expect(result).toBeNull();
    });

    it('should check if path exists', async () => {
      const path = '/images/products';
      await cache.set(path, testValue);
      
      expect(await cache.has(path)).toBe(true);
      expect(await cache.has('/non/existent')).toBe(false);
    });

    it('should delete values', async () => {
      const path = '/images/products';
      await cache.set(path, testValue);
      
      const deleted = await cache.delete(path);
      expect(deleted).toBe(true);
      expect(await cache.get(path)).toBeNull();
    });

    it('should return false when deleting non-existent path', async () => {
      const deleted = await cache.delete('/non/existent');
      expect(deleted).toBe(false);
    });

    it('should clear all values', async () => {
      await cache.set('/path1', testValue);
      await cache.set('/path2', testValue);
      
      await cache.clear();
      
      expect(await cache.size()).toBe(0);
      expect(await cache.get('/path1')).toBeNull();
      expect(await cache.get('/path2')).toBeNull();
    });

    it('should return correct size', async () => {
      expect(await cache.size()).toBe(0);
      
      await cache.set('/path1', testValue);
      expect(await cache.size()).toBe(1);
      
      await cache.set('/path2', testValue);
      expect(await cache.size()).toBe(2);
    });
  });

  describe('prefix matching', () => {
    beforeEach(async () => {
      // Set up hierarchical paths
      await cache.set('/images', createMockPathMapping({ path: '/images' }));
      await cache.set('/images/products', createMockPathMapping({ path: '/images/products' }));
      await cache.set('/images/products/electronics', createMockPathMapping({ path: '/images/products/electronics' }));
      await cache.set('/api/v1', createMockPathMapping({ path: '/api/v1' }));
    });

    it('should find exact matches first', async () => {
      const result = await cache.get('/images/products');
      expect(result?.path).toBe('/images/products');
    });

    it('should find longest prefix match when exact match not found', async () => {
      const result = await cache.findLongestPrefix('/images/products/phones');
      expect(result?.path).toBe('/images/products');
    });

    it('should find root level matches', async () => {
      const result = await cache.findLongestPrefix('/images/categories');
      expect(result?.path).toBe('/images');
    });

    it('should return null when no prefix matches', async () => {
      const result = await cache.findLongestPrefix('/videos/content');
      expect(result).toBeNull();
    });

    it('should handle root path correctly', async () => {
      await cache.set('/', createMockPathMapping({ path: '/' }));
      
      const result = await cache.findLongestPrefix('/anything/else');
      expect(result?.path).toBe('/');
    });

    it('should handle paths with trailing slashes', async () => {
      await cache.set('/images/', createMockPathMapping({ path: '/images/' }));
      
      const result = await cache.findLongestPrefix('/images/test');
      expect(result?.path).toBe('/images/');
    });
  });

  describe('value updates', () => {
    it('should update existing values', async () => {
      const path = '/images/products';
      const updatedValue = createMockPathMapping({ path, originId: 'updated-origin' });
      
      await cache.set(path, testValue);
      await cache.set(path, updatedValue);
      
      const result = await cache.get(path);
      expect(result).toEqual(updatedValue);
      expect(await cache.size()).toBe(1);
    });

    it('should maintain prefix matching after updates', async () => {
      const basePath = '/images';
      const nestedPath = '/images/products';
      const updatedValue = createMockPathMapping({ path: basePath, originId: 'updated' });
      
      await cache.set(basePath, testValue);
      await cache.set(nestedPath, testValue);
      
      // Update base path
      await cache.set(basePath, updatedValue);
      
      // Should still find updated base for prefix match
      const result = await cache.findLongestPrefix('/images/categories');
      expect(result?.originId).toBe('updated');
      
      // Nested path should be unchanged
      const nestedResult = await cache.get(nestedPath);
      expect(nestedResult?.originId).toBe(testValue.originId);
    });
  });

  describe('wildcard matching', () => {
    beforeEach(async () => {
      // Set up wildcard and exact patterns
      await cache.set('/api/*', createMockPathMapping({ path: '/api/*', originId: 'wildcard-origin' }));
      await cache.set('/api/users', createMockPathMapping({ path: '/api/users', originId: 'exact-origin' }));
      await cache.set('/', createMockPathMapping({ path: '/', originId: 'root-origin' }));
    });

    it('should match wildcard patterns', async () => {
      const result = await cache.findLongestPrefix('/api/posts');
      expect(result?.originId).toBe('wildcard-origin');
    });

    it('should prioritize exact matches over wildcards', async () => {
      const result = await cache.findLongestPrefix('/api/users');
      expect(result?.originId).toBe('exact-origin');
    });

    it('should find longest wildcard match', async () => {
      await cache.set('/api/v1/*', createMockPathMapping({ path: '/api/v1/*', originId: 'v1-wildcard' }));
      
      const result = await cache.findLongestPrefix('/api/v1/posts');
      expect(result?.originId).toBe('v1-wildcard');
    });

    it('should fall back to parent patterns when no wildcard matches', async () => {
      const result = await cache.findLongestPrefix('/other/path');
      expect(result?.originId).toBe('root-origin');
    });

    it('should handle multiple wildcard levels', async () => {
      await cache.set('/api/*/admin', createMockPathMapping({ path: '/api/*/admin', originId: 'admin-wildcard' }));
      
      const result = await cache.findLongestPrefix('/api/v2/admin');
      expect(result?.originId).toBe('admin-wildcard');
    });
  });

  describe('prefix matching configuration', () => {
    describe('when prefix matching is enabled (path mapping)', () => {
      let pathCache: TrieCache<any>;

      beforeEach(() => {
        pathCache = new TrieCache<any>({
          name: 'test-path-cache',
          maxDepth: 10,
          pathSeparator: '/',
          allowPrefixMatching: true
        });
      });

      it('should allow prefix matching for hierarchical paths', async () => {
        await pathCache.set('/api', createMockPathMapping({ path: '/api', originId: 'api-root' }));
        
        // Should match /api for longer paths
        const result = await pathCache.findLongestPrefix('/api/users/123');
        expect(result?.originId).toBe('api-root');
      });

      it('should find longest prefix match', async () => {
        await pathCache.set('/api', createMockPathMapping({ path: '/api', originId: 'api-root' }));
        await pathCache.set('/api/users', createMockPathMapping({ path: '/api/users', originId: 'api-users' }));
        
        const result = await pathCache.findLongestPrefix('/api/users/profile');
        expect(result?.originId).toBe('api-users');
      });

      it('should work with wildcards and prefix matching', async () => {
        await pathCache.set('/api/*', createMockPathMapping({ path: '/api/*', originId: 'api-wildcard' }));
        await pathCache.set('/api/users', createMockPathMapping({ path: '/api/users', originId: 'api-users-exact' }));
        
        // Wildcard should match
        const wildcardResult = await pathCache.findLongestPrefix('/api/posts/123');
        expect(wildcardResult?.originId).toBe('api-wildcard');
        
        // Exact should take priority
        const exactResult = await pathCache.findLongestPrefix('/api/users');
        expect(exactResult?.originId).toBe('api-users-exact');
      });
    });

    describe('when prefix matching is disabled (header mapping)', () => {
      let headerCache: TrieCache<any>;

      beforeEach(() => {
        headerCache = new TrieCache<any>({
          name: 'test-header-cache',
          maxDepth: 10,
          pathSeparator: '.',
          allowPrefixMatching: false
        });
      });

      it('should NOT allow prefix matching for security', async () => {
        await headerCache.set('example.com', createMockPathMapping({ path: 'example.com', originId: 'trusted-origin' }));
        
        // This should NOT match - security risk!
        const result = await headerCache.findLongestPrefix('example.com.evil.com');
        expect(result).toBeNull();
      });

      it('should allow exact matches', async () => {
        await headerCache.set('api.example.com', createMockPathMapping({ path: 'api.example.com', originId: 'exact-host' }));
        
        const result = await headerCache.findLongestPrefix('api.example.com');
        expect(result?.originId).toBe('exact-host');
      });

      it('should allow wildcard matches', async () => {
        await headerCache.set('*.example.com', createMockPathMapping({ path: '*.example.com', originId: 'wildcard-host' }));
        
        const result = await headerCache.findLongestPrefix('test.example.com');
        expect(result?.originId).toBe('wildcard-host');
      });

      it('should prioritize exact over wildcard matches', async () => {
        await headerCache.set('*.example.com', createMockPathMapping({ path: '*.example.com', originId: 'wildcard-host' }));
        await headerCache.set('api.example.com', createMockPathMapping({ path: 'api.example.com', originId: 'exact-host' }));
        
        const exactResult = await headerCache.findLongestPrefix('api.example.com');
        expect(exactResult?.originId).toBe('exact-host');
        
        const wildcardResult = await headerCache.findLongestPrefix('test.example.com');
        expect(wildcardResult?.originId).toBe('wildcard-host');
      });

      it('should handle nested wildcard domains', async () => {
        await headerCache.set('*.api.example.com', createMockPathMapping({ path: '*.api.example.com', originId: 'api-wildcard' }));
        await headerCache.set('*.example.com', createMockPathMapping({ path: '*.example.com', originId: 'root-wildcard' }));
        
        const result = await headerCache.findLongestPrefix('v1.api.example.com');
        expect(result?.originId).toBe('api-wildcard');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty path', async () => {
      await cache.set('', testValue);
      expect(await cache.get('')).toEqual(testValue);
    });

    it('should handle paths without leading slash', async () => {
      await cache.set('images/products', testValue);
      expect(await cache.get('images/products')).toEqual(testValue);
    });

    it('should handle very long paths', async () => {
      const longPath = '/very/long/path/with/many/segments/that/goes/on/and/on';
      await cache.set(longPath, testValue);
      expect(await cache.get(longPath)).toEqual(testValue);
    });

    it('should handle special characters in paths', async () => {
      const specialPath = '/images/products/item-123_test.jpg';
      await cache.set(specialPath, testValue);
      expect(await cache.get(specialPath)).toEqual(testValue);
    });

    it('should handle multiple overlapping prefixes', async () => {
      await cache.set('/api', createMockPathMapping({ path: '/api' }));
      await cache.set('/api/v1', createMockPathMapping({ path: '/api/v1' }));
      await cache.set('/api/v1/users', createMockPathMapping({ path: '/api/v1/users' }));
      
      expect((await cache.get('/api'))?.path).toBe('/api');
      expect((await cache.get('/api/v1'))?.path).toBe('/api/v1');
      expect((await cache.get('/api/v1/users'))?.path).toBe('/api/v1/users');
      expect((await cache.findLongestPrefix('/api/v1/users/123'))?.path).toBe('/api/v1/users');
    });
  });
});
