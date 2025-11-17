// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../setupTests';
import { TransformationPolicyService } from '../../services/transformationPolicyService';

// Mock Amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    getConfig: () => ({
      API: {
        REST: {
          AdminAPI: {
            endpoint: 'https://test-api.execute-api.us-east-1.amazonaws.com/prod'
          }
        }
      }
    })
  }
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      accessToken: {
        toString: () => 'mock-access-token'
      }
    }
  })
}));

describe('TransformationPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should fetch policies without parameters', async () => {
      const result = await TransformationPolicyService.list();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('items');
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it('should fetch policies with nextToken parameter', async () => {
      const result = await TransformationPolicyService.list({ nextToken: 'token123' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('items');
    });
  });

  describe('get', () => {
    it('should fetch a single policy by id', async () => {
      const result = await TransformationPolicyService.get('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('policyId');
      expect(result.data).toHaveProperty('policyName');
    });
  });

  describe('create', () => {
    it('should create a new policy', async () => {
      const newPolicy = { 
        policyName: 'Test Policy', 
        transformations: [],
        outputs: [],
        isDefault: false
      };

      const result = await TransformationPolicyService.create(newPolicy);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('items');
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it('should handle creation errors', async () => {
      server.use(
        http.post('*/policies', () => {
          return HttpResponse.json({ error: 'A default policy already exists' }, { status: 400 });
        })
      );

      const duplicateDefaultPolicy = { 
        policyName: 'New Default Policy', 
        transformations: [],
        outputs: [],
        isDefault: true // Attempting to create another default policy
      };

      await expect(TransformationPolicyService.create(duplicateDefaultPolicy))
        .rejects.toThrow('A default policy already exists');
    });
  });

  describe('update', () => {
    it('should update an existing policy', async () => {
      const updateData = { policyName: 'Updated Policy Name' };

      const result = await TransformationPolicyService.update('550e8400-e29b-41d4-a716-446655440001', updateData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('policyId');
    });
  });

  describe('delete', () => {
    it('should delete a policy', async () => {
      const result = await TransformationPolicyService.delete('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(true);
    });
  });
});
