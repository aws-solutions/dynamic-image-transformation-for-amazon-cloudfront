// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { applyPrecedence, enforceLimits } from './transformation-limiter';
import { Transformation } from '../../../types/transformation';

describe('transformation-limiter', () => {
  describe('applyPrecedence', () => {
    it('should deduplicate transformations by type, preferring URL over policy', () => {
      const urlTransformations: Transformation[] = [{
        type: 'quality',
        value: 80,
        source: 'url'
      }];
      
      const policyTransformations: Transformation[] = [{
        type: 'quality',
        value: 90,
        source: 'policy'
      }];
      
      const result = applyPrecedence(urlTransformations, policyTransformations);
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(80);
      expect(result[0].source).toBe('url');
    });

    it('should prioritize policy order with URL transformations appended', () => {
      const urlTransformations: Transformation[] = [
        { type: 'resize', value: { width: 300 }, source: 'url' },
        { type: 'quality', value: 80, source: 'url' }
      ];
      
      const policyTransformations: Transformation[] = [
        { type: 'format', value: 'webp', source: 'policy' },
        { type: 'rotate', value: 90, source: 'policy' }
      ];
      
      const result = applyPrecedence(urlTransformations, policyTransformations);
      
      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('format');
      expect(result[1].type).toBe('rotate');
      expect(result[2].type).toBe('resize');
      expect(result[3].type).toBe('quality');
    });

    it('should assign correct source values', () => {
      const urlTransformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'url'
      }];
      
      const policyTransformations: Transformation[] = [{
        type: 'quality',
        value: 85,
        source: 'policy'
      }];
      
      const result = applyPrecedence(urlTransformations, policyTransformations);
      
      expect(result[0].source).toBe('policy');
      expect(result[1].source).toBe('url');
    });

    it('should override policy transformations with URL transformations of same type', () => {
      const urlTransformations: Transformation[] = [
        { type: 'quality', value: 75, source: 'url' },
        { type: 'resize', value: { width: 200 }, source: 'url' }
      ];
      
      const policyTransformations: Transformation[] = [
        { type: 'format', value: 'jpeg', source: 'policy' },
        { type: 'quality', value: 90, source: 'policy' },
        { type: 'rotate', value: 45, source: 'policy' }
      ];
      
      const result = applyPrecedence(urlTransformations, policyTransformations);
      
      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('format');
      expect(result[0].source).toBe('policy');
      expect(result[1].type).toBe('quality');
      expect(result[1].value).toBe(75);
      expect(result[1].source).toBe('url');
      expect(result[2].type).toBe('rotate');
      expect(result[2].source).toBe('policy');
      expect(result[3].type).toBe('resize');
      expect(result[3].source).toBe('url');
    });

    it('should handle empty arrays', () => {
      expect(applyPrecedence([], [])).toEqual([]);
      expect(applyPrecedence([{ type: 'resize', value: 100, source: 'url' }], [])).toHaveLength(1);
      expect(applyPrecedence([], [{ type: 'quality', value: 80, source: 'policy' }])).toHaveLength(1);
    });
  });

  describe('enforceLimits', () => {
    it('should return all transformations when under limit', () => {
      const transformations: Transformation[] = [
        { type: 'resize', value: { width: 300 }, source: 'url' },
        { type: 'quality', value: 80, source: 'url' }
      ];
      
      const result = enforceLimits(transformations);
      
      expect(result).toEqual(transformations);
    });

    it('should truncate transformations when over limit', () => {
      const transformations: Transformation[] = Array.from({ length: 15 }, (_, i) => ({
        type: `transform${i}`,
        value: i,
        source: 'url' as const
      }));
      
      const result = enforceLimits(transformations);
      
      expect(result).toHaveLength(10);
      expect(result).toEqual(transformations.slice(0, 10));
    });

    it('should log warning when limit exceeded', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const transformations: Transformation[] = Array.from({ length: 12 }, (_, i) => ({
        type: `transform${i}`,
        value: i,
        source: 'url' as const
      }));
      
      enforceLimits(transformations);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Transformation limit of 10 exceeded',
        expect.objectContaining({
          totalTransformations: 12,
          droppedCount: 2
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should respect MAX_TRANSFORMATIONS environment variable', () => {
      const originalEnv = process.env.MAX_TRANSFORMATIONS;
      process.env.MAX_TRANSFORMATIONS = '5';
      
      // Need to re-import to pick up new env var
      jest.resetModules();
      const { enforceLimits: newEnforceLimits } = require('./transformation-limiter');
      
      const transformations: Transformation[] = Array.from({ length: 8 }, (_, i) => ({
        type: `transform${i}`,
        value: i,
        source: 'url' as const
      }));
      
      const result = newEnforceLimits(transformations);
      
      expect(result).toHaveLength(5);
      
      if (originalEnv) {
        process.env.MAX_TRANSFORMATIONS = originalEnv;
      } else {
        delete process.env.MAX_TRANSFORMATIONS;
      }
    });
  });
});