// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { validateTransformationValue, getValidationConstraints } from '../../utils/transformationValidation';

vi.mock('@data-models', () => ({
  transformationSchemas: {
    quality: { safeParse: vi.fn() },
    blur: { safeParse: vi.fn() },
    rotate: { safeParse: vi.fn() }
  }
}));

describe('transformationValidation - Core Validation Infrastructure', () => {
  describe('validateTransformationValue', () => {
    it('should return success for unknown transformation types', async () => {
      const result = validateTransformationValue('unknown', 50);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(50);
    });

    it('should validate using schema when available', async () => {
      const { transformationSchemas } = await import('@data-models');
      vi.mocked(transformationSchemas.quality.safeParse).mockReturnValue({ success: true, data: 80 });

      const result = validateTransformationValue('quality', 80);

      expect(transformationSchemas.quality.safeParse).toHaveBeenCalledWith(80);
      expect(result.success).toBe(true);
    });
  });

  describe('getValidationConstraints', () => {
    it('should return quality constraints', () => {
      const constraints = getValidationConstraints('quality');
      
      expect(constraints).toEqual({ min: 1, max: 100, step: 1, type: 'integer' });
    });

    it('should return resize constraints with width and height', () => {
      const constraints = getValidationConstraints('resize');
      
      expect(constraints).toEqual({
        width: { min: 1, max: 4000, step: 1, type: 'integer' },
        height: { min: 1, max: 4000, step: 1, type: 'integer' }
      });
    });

    it('should return empty object for unknown types', () => {
      const constraints = getValidationConstraints('unknown');
      
      expect(constraints).toEqual({});
    });
  });
});
