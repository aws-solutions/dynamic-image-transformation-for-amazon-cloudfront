// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  validateOriginCreateData,
  validateOriginUpdateData,
  validateMappingCreateData,
  validateMappingUpdateData,
  validateTransformationPolicyCreateData,
  validateTransformationPolicyUpdateData
} from '../../utils/validation';

vi.mock('@data-models', () => ({
  validateOriginCreate: vi.fn(),
  validateOriginUpdate: vi.fn(),
  validateMappingCreate: vi.fn(),
  validateMappingUpdate: vi.fn(),
  validateTransformationPolicyCreate: vi.fn(),
  validateTransformationPolicyUpdate: vi.fn()
}));

describe('validation - Core Validation Infrastructure', () => {
  describe('Error Formatting', () => {
    it('should format ZodError with nested paths correctly', async () => {
      const { validateOriginCreate } = await import('@data-models');
      vi.mocked(validateOriginCreate).mockReturnValue({
        success: false,
        error: new ZodError([
          { path: ['name'], message: 'Required field', code: 'invalid_type', expected: 'string', received: 'undefined' },
          { path: ['config', 'url'], message: 'Invalid URL', code: 'invalid_string', validation: 'url' }
        ])
      });

      const result = validateOriginCreateData({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({
        'name': 'Required field',
        'config.url': 'Invalid URL'
      });
    });
  });

  describe('Origin Validation', () => {
    it('should validate origin create data successfully', async () => {
      const { validateOriginCreate } = await import('@data-models');
      vi.mocked(validateOriginCreate).mockReturnValue({ success: true });

      const result = validateOriginCreateData({ name: 'test' });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should handle origin update validation errors', async () => {
      const { validateOriginUpdate } = await import('@data-models');
      vi.mocked(validateOriginUpdate).mockImplementation(() => {
        throw new ZodError([{ path: ['id'], message: 'Invalid ID', code: 'invalid_type', expected: 'string', received: 'number' }]);
      });

      const result = validateOriginUpdateData({ id: 123 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({ 'id': 'Invalid ID' });
    });
  });

  describe('Mapping Validation', () => {
    it('should validate mapping create data successfully', async () => {
      const { validateMappingCreate } = await import('@data-models');
      vi.mocked(validateMappingCreate).mockReturnValue({ success: true });

      const result = validateMappingCreateData({ path: '/test' });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should handle mapping update validation failures', async () => {
      const { validateMappingUpdate } = await import('@data-models');
      vi.mocked(validateMappingUpdate).mockReturnValue({
        success: false,
        error: new ZodError([{ path: ['path'], message: 'Invalid path format', code: 'custom' }])
      });

      const result = validateMappingUpdateData({ path: 'invalid' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({ 'path': 'Invalid path format' });
    });
  });

  describe('Transformation Policy Validation', () => {
    it('should validate policy create data successfully', async () => {
      const { validateTransformationPolicyCreate } = await import('@data-models');
      vi.mocked(validateTransformationPolicyCreate).mockImplementation(() => {});

      const result = validateTransformationPolicyCreateData({ name: 'policy' });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should handle general validation errors', async () => {
      const { validateTransformationPolicyUpdate } = await import('@data-models');
      vi.mocked(validateTransformationPolicyUpdate).mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = validateTransformationPolicyUpdateData({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({ 'general': 'Validation failed' });
    });
  });
});
