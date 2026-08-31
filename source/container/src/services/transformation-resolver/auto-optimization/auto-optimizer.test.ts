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

    it('should prioritize formats by priority order (webp, avif, jpeg, png)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/jpeg,image/avif,image/avif,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('avif');
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

    it('should use fallback.format when dit-accept header is absent and value is auto', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto', fallback: { format: 'jpeg' } }];
      mockRequest.headers = {};

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'format', value: 'jpeg', source: 'auto' });
    });

    it('should not use fallback when dit-accept header is absent and no fallback defined', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = {};

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

      expect(result).toHaveLength(0);
    });

    it('should ignore fallback when value is a static format (not auto)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'png', fallback: { format: 'jpeg' } }];
      mockRequest.headers = {};

      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'format', value: 'png', source: 'auto' });
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
    describe('dit-dpr (CloudFront function output)', () => {
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

      it('should cap dit-dpr at 5.0 instead of using a forged higher value', () => {
        // The header is client-forgeable (CF-bypassed deployments, fail-open passthrough);
        // 5.0 mirrors the CloudFront function's normalization cap.
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 5, 85], [5, 100, 40]]
        }];
        mockRequest.headers = { 'dit-dpr': '50' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(40);
      });
    });

    describe('raw client hints are ignored (CF function is the sole normalizer)', () => {
      it('should ignore sec-ch-dpr and use the policy default when only sec-ch-dpr is set', () => {
        // sec-ch-dpr is NOT in the CloudFront cache key; honoring it would poison a shared key.
        // With no dit-dpr and no policy fallback, quality resolves to the default (qualityConfig[0]).
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 3, 85], [3, 4, 80]]
        }];
        mockRequest.headers = { 'sec-ch-dpr': '2.5' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ type: 'quality', value: 90, source: 'auto' });
      });

      it('should ignore sec-ch-dpr and use the policy fallback when only sec-ch-dpr is set', () => {
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 3, 85], [3, 4, 80]],
          fallback: { dpr: 2.5 }
        }];
        mockRequest.headers = { 'sec-ch-dpr': '3.5' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        // sec-ch-dpr (3.5) ignored; fallback.dpr (2.5) drives the lookup into the [2, 3) range
        expect(result[0].value).toBe(85);
      });

      it('should honor dit-dpr and ignore sec-ch-dpr when both are present', () => {
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 3, 85], [3, 4, 80]]
        }];
        mockRequest.headers = { 'dit-dpr': '1.5', 'sec-ch-dpr': '3.5' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(90);
      });

      it('should ignore sec-ch-dpr when dit-dpr is invalid, falling through to the policy default', () => {
        // dit-dpr invalid -> null; sec-ch-dpr is not consulted -> no fallback -> default.
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 3, 85], [3, 4, 80]]
        }];
        mockRequest.headers = { 'dit-dpr': 'invalid', 'sec-ch-dpr': '2.5' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(90);
      });
    });

    describe('policy fallback DPR', () => {
      it('should use fallback.dpr for quality lookup when no DPR header is present', () => {
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 3, 85], [3, 4, 80]],
          fallback: { dpr: 2.5 }
        }];
        mockRequest.headers = {};

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ type: 'quality', value: 85, source: 'auto' });
      });
    });

    describe('no signal', () => {
      it('should use qualityConfig[0] when no DPR header is present and no fallback defined', () => {
        mockPolicy.outputs = [{
          type: 'quality',
          value: [90, [1, 2, 90], [2, 3, 85]]
        }];
        mockRequest.headers = {};

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ type: 'quality', value: 90, source: 'auto' });
      });
    });
  });

  describe('size optimizations', () => {
    describe('dit-viewport-width (CloudFront function output)', () => {
      it('should use dit-viewport-width directly without snapping to policy breakpoints', () => {
        // The CloudFront function has already normalized the viewport; ECS must not snap again.
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200]
        }];
        mockRequest.headers = { 'dit-viewport-width': '800' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          type: 'resize',
          value: { width: 800 },
          source: 'auto'
        });
      });

      it('should use dit-viewport-width directly even when it exactly matches a breakpoint', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200]
        }];
        mockRequest.headers = { 'dit-viewport-width': '1024' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toEqual({ width: 1024 });
      });

      it('should use dit-viewport-width directly even when it is not in the policy breakpoints', () => {
        // 1024 is produced by the CF function but absent from the video-resolution policy array;
        // it must still be honored exactly rather than overshooting to 1080.
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [320, 480, 720, 1080, 1440, 1920]
        }];
        mockRequest.headers = { 'dit-viewport-width': '1024' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toEqual({ width: 1024 });
      });

      it('should reject a dit-viewport-width above 7680 instead of using it as the resize width', () => {
        // The header is client-forgeable (CF-bypassed deployments, fail-open passthrough); an
        // unbounded value would demand an arbitrarily large upscale. Falls through to the policy fallback.
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200],
          fallback: { viewportWidth: 800 }
        }];
        mockRequest.headers = { 'dit-viewport-width': '100000' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toEqual({ width: 1024 });
      });

      it('should accept a dit-viewport-width of exactly 7680', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200]
        }];
        mockRequest.headers = { 'dit-viewport-width': '7680' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toEqual({ width: 7680 });
      });
    });

    describe('raw client hints are ignored (CF function is the sole normalizer)', () => {
      it('should ignore sec-ch-viewport-width and return [] when no dit-viewport-width or fallback is set', () => {
        // sec-ch-* is NOT in the CloudFront cache key; honoring it would poison a shared key.
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200]
        }];
        mockRequest.headers = { 'sec-ch-viewport-width': '800' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(0);
      });

      it('should ignore sec-ch-viewport-width and use the policy fallback viewport width instead', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200],
          fallback: { viewportWidth: 500 }
        }];
        mockRequest.headers = { 'sec-ch-viewport-width': '1100' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        // sec-ch-viewport-width (1100) ignored; fallback (500) snaps up to 768
        expect(result[0].value).toEqual({ width: 768 });
      });

      it('should ignore sec-ch-width and use the policy fallback viewport width instead', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200],
          fallback: { viewportWidth: 500 }
        }];
        mockRequest.headers = { 'sec-ch-width': '1100' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        // sec-ch-width (1100) ignored; fallback (500) snaps up to 768
        expect(result[0].value).toEqual({ width: 768 });
      });

      it('should honor dit-viewport-width and ignore raw client hints when both are present', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1200]
        }];
        mockRequest.headers = { 'dit-viewport-width': '900', 'sec-ch-viewport-width': '500' };

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        // dit-viewport-width wins and is used directly (no snap)
        expect(result[0].value).toEqual({ width: 900 });
      });
    });

    describe('policy fallback viewport width', () => {
      it('should snap fallback.viewportWidth using >= so an exact breakpoint match is honored', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1920],
          fallback: { viewportWidth: 1024 }
        }];
        mockRequest.headers = {};

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ type: 'resize', value: { width: 1024 }, source: 'auto' });
      });

      it('should snap fallback.viewportWidth up to the nearest breakpoint', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1920],
          fallback: { viewportWidth: 800 }
        }];
        mockRequest.headers = {};

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(1);
        expect(result[0].value).toEqual({ width: 1024 });
      });
    });

    describe('no signal', () => {
      it('should return [] when no viewport signal is present and no fallback is defined', () => {
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [480, 768, 1024, 1920]
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

      it('should not optimize size when the breakpoint array is empty', () => {
        // An empty array would make snapToBreakpoint return undefined, emitting width: undefined.
        // Drive the fallback path (raw client hints are ignored) to exercise the guard.
        mockPolicy.outputs = [{
          type: 'autosize',
          value: [],
          fallback: { viewportWidth: 500 }
        }];
        mockRequest.headers = {};

        const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);

        expect(result).toHaveLength(0);
      });
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