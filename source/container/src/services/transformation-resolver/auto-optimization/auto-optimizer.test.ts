// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { applyAutoOptimizations } from './auto-optimizer';
import { Transformation, TransformationPolicy } from '../../../types/transformation';
import { ImageProcessingRequest } from '../../../types/image-processing-request';

describe('applyAutoOptimizations', () => {
  let mockRequest: Partial<Request>;
  let baseTransformations: Transformation[];
  let mockPolicy: TransformationPolicy;

  beforeEach(() => {
    mockRequest = {
      header: jest.fn((name: string) => {
        if (name === 'set-cookie') {
          return mockRequest.headers?.[name.toLowerCase()] as string[] | undefined;
        }
        return mockRequest.headers?.[name.toLowerCase()] as string | undefined;
      }) as any
    };

    baseTransformations = [];
    
    mockPolicy = {
      policyId: 'test-policy',
      policyName: 'Test Policy',
      transformations: [],
      isDefault: false
    };
  });

  describe('format optimizations', () => {
    it('should optimize format when policy output format is auto', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'text/html,image/jpg,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'format',
        value: 'jpeg',
        source: 'auto'
      });
    });

    it('should prefer webp over avif when both are accepted (post-revert)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,image/avif,*/*' };

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('webp');
    });

    it('should still pick avif when only avif is accepted (no webp present)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/avif,image/jpeg,*/*' };

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('avif');
    });

    it('should prefer avif over jpeg when both are accepted', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/jpeg,image/avif,*/*' };

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('avif');
    });

    it('should skip format optimization when source is ICO (image/x-icon)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      const imageRequest = { sourceImageContentType: 'image/x-icon' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });

    it('should skip format optimization when source is image/vnd.microsoft.icon', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      const imageRequest = { sourceImageContentType: 'image/vnd.microsoft.icon' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });

    it('should skip format optimization when source is image/ico (legacy MIME)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      const imageRequest = { sourceImageContentType: 'image/ico' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });
    
    it('should skip format optimization when source is SVG (Issue #11)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      const imageRequest = { sourceImageContentType: 'image/svg+xml' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });
    it('should skip format optimization when source is BMP (Issue #13)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      const imageRequest = { sourceImageContentType: 'image/bmp' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });

    it('should skip format optimization when source is image/x-ms-bmp', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      const imageRequest = { sourceImageContentType: 'image/x-ms-bmp' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });

    it('should apply static format when policy format is not auto', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'jpeg' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'format',
        value: 'jpeg',
        source: 'auto'
      });
    });

    it('should ignore wildcards and return no format optimization', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/*,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
    });

    it('should skip format conversion when source is GIF and selected format is not animation-capable', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/jpeg' };
      const imageRequest = { sourceImageContentType: 'image/gif' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });

    it('should allow format conversion when source is GIF and selected format is webp', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp' };
      const imageRequest = { sourceImageContentType: 'image/gif' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'format', value: 'webp', source: 'auto' });
    });

    it('should allow format conversion when source is GIF and selected format is avif', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/avif' };
      const imageRequest = { sourceImageContentType: 'image/gif' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'format', value: 'avif', source: 'auto' });
    });

    it('should skip format conversion when source is animated-capable WebP and selected format is JPEG (Issue #7)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/jpeg' };
      const imageRequest = { sourceImageContentType: 'image/webp' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      // JPEG cannot carry animation; auto-optimizer must not convert WebP -> JPEG
      expect(result).toHaveLength(0);
    });

    it('should skip format conversion when source is WebP and selected format is PNG (Issue #7)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/png' };
      const imageRequest = { sourceImageContentType: 'image/webp' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(0);
    });

    it('should allow format conversion when source is WebP and selected format is AVIF (animation-capable)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/avif' };
      const imageRequest = { sourceImageContentType: 'image/webp' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'format', value: 'avif', source: 'auto' });
    });

    it('should return [] (no-op) when source WebP matches selected WebP', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp' };
      const imageRequest = { sourceImageContentType: 'image/webp' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      // Pre-existing same-format guard at auto-optimizer.ts:96-101 still wins
      expect(result).toHaveLength(0);
    });



    it('should not restrict format selection for non-GIF sources', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/jpeg' };
      const imageRequest = { sourceImageContentType: 'image/png' } as ImageProcessingRequest;

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy, imageRequest);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'format', value: 'jpeg', source: 'auto' });
    });


  });

  describe('quality optimizations', () => {
    it('should optimize quality based on DPR header with policy mappings', () => {
      mockPolicy.outputs = [{
        type: 'quality',
        value: [90, [1, 2, 90], [2, 3, 85], [3, 4, 80]]
      }];
      mockRequest.headers = { 'dit-dpr': '2.5' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'quality',
        value: 85,
        source: 'auto'
      });
    });

    it('should apply static quality when policy has single quality value', () => {
      mockPolicy.outputs = [{
        type: 'quality',
        value: [80]
      }];
      mockRequest.headers = { 'dit-dpr': '2' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'quality',
        value: 80,
        source: 'auto'
      });
    });

    it('should not optimize quality when quality output is missing', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-dpr': '2' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
    });


  });

  describe('size optimizations', () => {
    it('should optimize size based on viewport-width with policy breakpoints', () => {
      mockPolicy.outputs = [{
        type: 'autosize',
        value: [480, 768, 1024, 1200]
      }];
      mockRequest.headers = { 'dit-viewport-width': '800' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'resize',
        value: { width: 1024 },
        source: 'auto'
      });
    });

    it('should use largest breakpoint when viewport exceeds all breakpoints', () => {
      mockPolicy.outputs = [{
        type: 'autosize',
        value: [480, 768, 1024]
      }];
      mockRequest.headers = { 'dit-viewport-width': '1500' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toEqual({ width: 1024 });
    });

    it('should not optimize size when viewport width header is not present', () => {
      mockPolicy.outputs = [{
        type: 'autosize',
        value: [480, 768, 1024]
      }];
      mockRequest.headers = {};
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
    });

    it('should not optimize size when autosize output is not defined', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-viewport-width': '800' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
    });


  });

  describe('optimization combination', () => {
    it('should apply multiple optimizations together', () => {
      mockPolicy.outputs = [
        { type: 'format', value: 'auto' },
        { type: 'quality', value: [90, [1, 2, 90], [2, 3, 85]] },
        { type: 'autosize', value: [480, 768, 1024] }
      ];
      mockRequest.headers = {
        'dit-accept': 'image/webp,*/*',
        'dit-dpr': '2',
        'dit-viewport-width': '600'
      };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(3);
      expect(result.map(t => t.type)).toContain('format');
      expect(result.map(t => t.type)).toContain('quality');
      expect(result.map(t => t.type)).toContain('resize');
    });

    it('should preserve existing transformations', () => {
      baseTransformations = [{
        type: 'rotate',
        value: 90,
        source: 'url'
      }];
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('rotate');
      expect(result[1].type).toBe('format');
    });


  });

  describe('edge cases', () => {
    it('should handle invalid viewport width values', () => {
      mockPolicy.outputs = [{
        type: 'autosize',
        value: [480, 768, 1024]
      }];
      mockRequest.headers = { 'dit-viewport-width': 'invalid' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
    });

    it('should handle invalid DPR values', () => {
      mockPolicy.outputs = [{
        type: 'quality',
        value: [80, [1, 2, 90], [2, 3, 85]]
      }];
      mockRequest.headers = { 'dit-dpr': 'invalid' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('quality');
      expect(result[0].value).toBe(80);
    });


  });
});