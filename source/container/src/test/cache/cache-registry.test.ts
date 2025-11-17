// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CacheRegistry } from '../../services/cache/cache-registry';
import { PolicyCache } from '../../services/cache/domain/policy-cache';
import { OriginCache } from '../../services/cache/domain/origin-cache';
import { PathMappingCache } from '../../services/cache/domain/path-mapping-cache';
import { HeaderMappingCache } from '../../services/cache/domain/header-mapping-cache';

describe('CacheRegistry', () => {
  let registry: CacheRegistry;

  beforeEach(() => {
    registry = CacheRegistry.getInstance();
    registry.clear();
  });

  describe('register and get', () => {
    it('should register and retrieve cache successfully', () => {
      const mockCache = {} as PolicyCache;
      
      registry.register('test', mockCache);
      const retrieved = registry.get<PolicyCache>('test');
      
      expect(retrieved).toBe(mockCache);
    });

    it('should return undefined for unregistered cache', () => {
      const retrieved = registry.get<PolicyCache>('nonexistent');
      
      expect(retrieved).toBeUndefined();
    });
  });

  describe('typed cache getters', () => {
    it('should return policy cache when registered', () => {
      const mockPolicyCache = {} as PolicyCache;
      registry.register('policy', mockPolicyCache);
      
      const retrieved = registry.getPolicyCache();
      
      expect(retrieved).toBe(mockPolicyCache);
    });

    it('should return origin cache when registered', () => {
      const mockOriginCache = {} as OriginCache;
      registry.register('origin', mockOriginCache);
      
      const retrieved = registry.getOriginCache();
      
      expect(retrieved).toBe(mockOriginCache);
    });

    it('should return path mapping cache when registered', () => {
      const mockPathMappingCache = {} as PathMappingCache;
      registry.register('pathMapping', mockPathMappingCache);
      
      const retrieved = registry.getPathMappingCache();
      
      expect(retrieved).toBe(mockPathMappingCache);
    });

    it('should return header mapping cache when registered', () => {
      const mockHeaderMappingCache = {} as HeaderMappingCache;
      registry.register('headerMapping', mockHeaderMappingCache);
      
      const retrieved = registry.getHeaderMappingCache();
      
      expect(retrieved).toBe(mockHeaderMappingCache);
    });

    it('should throw error when policy cache not registered', () => {
      expect(() => registry.getPolicyCache()).toThrow('Cache policy not found');
    });

    it('should throw error when origin cache not registered', () => {
      expect(() => registry.getOriginCache()).toThrow('Cache origin not found');
    });

    it('should throw error when path mapping cache not registered', () => {
      expect(() => registry.getPathMappingCache()).toThrow('Cache pathMapping not found');
    });

    it('should throw error when header mapping cache not registered', () => {
      expect(() => registry.getHeaderMappingCache()).toThrow('Cache headerMapping not found');
    });
  });

  describe('clear', () => {
    it('should remove all registered caches', () => {
      const mockCache1 = {} as PolicyCache;
      const mockCache2 = {} as OriginCache;
      
      registry.register('policy', mockCache1);
      registry.register('origin', mockCache2);
      
      registry.clear();
      
      expect(registry.get('policy')).toBeUndefined();
      expect(registry.get('origin')).toBeUndefined();
    });

    it('should make getters throw errors after clear', () => {
      const mockPolicyCache = {} as PolicyCache;
      registry.register('policy', mockPolicyCache);
      
      registry.clear();
      
      expect(() => registry.getPolicyCache()).toThrow('Cache policy not found');
    });
  });
});