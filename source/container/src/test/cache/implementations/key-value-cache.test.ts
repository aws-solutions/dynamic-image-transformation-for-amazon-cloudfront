// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { KeyValueCache } from '../../../services/cache/implementations/key-value-cache';
import { createMockPolicy } from '../__mocks__/test-fixtures';

describe('KeyValueCache', () => {
  let cache: KeyValueCache<any>;
  const testKey = 'test-key';
  const testValue = createMockPolicy();

  beforeEach(() => {
    cache = new KeyValueCache<any>({
      name: 'test-cache'
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set(testKey, testValue);
      const result = await cache.get(testKey);
      
      expect(result).toEqual(testValue);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set(testKey, testValue);
      
      expect(await cache.has(testKey)).toBe(true);
      expect(await cache.has('non-existent-key')).toBe(false);
    });

    it('should delete values', async () => {
      await cache.set(testKey, testValue);
      const deleted = await cache.delete(testKey);
      
      expect(deleted).toBe(true);
      expect(await cache.get(testKey)).toBeNull();
      expect(await cache.has(testKey)).toBe(false);
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('non-existent-key');
      
      expect(deleted).toBe(false);
    });

    it('should clear all values', async () => {
      await cache.set('key1', testValue);
      await cache.set('key2', testValue);
      
      await cache.clear();
      
      expect(await cache.size()).toBe(0);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should return correct size', async () => {
      expect(await cache.size()).toBe(0);
      
      await cache.set('key1', testValue);
      expect(await cache.size()).toBe(1);
      
      await cache.set('key2', testValue);
      expect(await cache.size()).toBe(2);
      
      await cache.delete('key1');
      expect(await cache.size()).toBe(1);
    });
  });



  describe('value updates', () => {
    it('should update existing values', async () => {
      const updatedValue = createMockPolicy({ policyId: 'updated-policy' });
      
      await cache.set(testKey, testValue);
      await cache.set(testKey, updatedValue);
      
      const result = await cache.get(testKey);
      expect(result).toEqual(updatedValue);
      expect(await cache.size()).toBe(1);
    });


  });
});
