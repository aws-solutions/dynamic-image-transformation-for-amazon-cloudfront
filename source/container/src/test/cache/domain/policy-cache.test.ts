// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PolicyCache } from '../../../services/cache/domain/policy-cache';
import { DDBDriver } from '../../../services/database/ddb-driver.interface';
import { createMockPolicy, mockPolicy, mockPolicyRecord } from '../__mocks__/test-fixtures';

// Mock the database module
jest.mock('../../../services/database', () => {
  const mockGetAllPolicies = jest.fn();
  return {
    ddbDriver: {
      instance: {
        getAllPolicies: mockGetAllPolicies
      }
    }
  };
});

// Get the mocked function for use in tests
const { ddbDriver } = require('../../../services/database');
const mockGetAllPolicies = ddbDriver.instance.getAllPolicies;

describe('PolicyCache', () => {
  let policyCache: PolicyCache;
  
  const testPolicyId = 'test-policy-1';
  const testPolicy = mockPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    policyCache = new PolicyCache();
  });

  describe('getPolicy', () => {
    it('should return null when policy not found in cache', async () => {
      const result = await policyCache.getPolicy(testPolicyId);
      expect(result).toBeNull();
    });

    it('should return policy when found in cache', async () => {
      // Pre-populate cache
      await policyCache.cachePolicy(testPolicy);
      
      const result = await policyCache.getPolicy(testPolicyId);
      expect(result).toEqual(testPolicy);
    });
  });

  describe('cachePolicy', () => {
    it('should manually cache a policy', async () => {
      await policyCache.cachePolicy(testPolicy);
      
      const result = await policyCache.getPolicy(testPolicyId);
      expect(result).toEqual(testPolicy);
    });
  });

  describe('warmCache', () => {
    it('should parse and cache policies from DDB records', async () => {
      mockGetAllPolicies.mockResolvedValue([mockPolicyRecord]);
      
      await policyCache.warmCache();
      
      const result = await policyCache.getPolicy(testPolicyId);
      expect(result).toEqual(testPolicy);
    });

    it('should skip invalid JSON policies during warming', async () => {
      const invalidRecord = { ...mockPolicyRecord, policyJSON: 'invalid-json' };
      mockGetAllPolicies.mockResolvedValue([invalidRecord]);
      
      await policyCache.warmCache();
      
      const result = await policyCache.getPolicy(testPolicyId);
      expect(result).toBeNull();
    });
  });

  describe('invalidatePolicy', () => {
    it('should remove policy from cache', async () => {
      // First, populate the cache
      await policyCache.cachePolicy(testPolicy);
      let result = await policyCache.getPolicy(testPolicyId);
      expect(result).toEqual(testPolicy);
      
      // Invalidate the cache
      await policyCache.invalidatePolicy(testPolicyId);
      
      // Verify policy is no longer in cache
      result = await policyCache.getPolicy(testPolicyId);
      expect(result).toBeNull();
    });
  });

  describe('getDefault', () => {
    it('should return null when no default policy exists', async () => {
      const result = policyCache.getDefault();
      expect(result).toBeNull();
    });

    it('should return default policy after warmCache', async () => {
      const defaultPolicyRecord = { ...mockPolicyRecord, isDefault: true };
      mockGetAllPolicies.mockResolvedValue([defaultPolicyRecord]);
      
      await policyCache.warmCache();
      
      const result = policyCache.getDefault();
      expect(result?.isDefault).toBe(true);
    });
  });
});