// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { applyAutoOptimizations } from './auto-optimizer';
import { Transformation, TransformationPolicy } from '../../../types/transformation';

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
      mockRequest.headers = { 'dit-accept': 'text/html,image/webp,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'format',
        value: 'webp',
        source: 'auto'
      });
    });

    it('should prioritize formats by priority order (webp, avif, jpeg, png)', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-accept': 'image/jpeg,image/webp,image/avif,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('webp');
    });

    it('should not optimize format when policy format is not auto', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'jpeg' }];
      mockRequest.headers = { 'dit-accept': 'image/webp,*/*' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
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

    it('should not optimize quality when policy quality type is not auto', () => {
      mockPolicy.outputs = [{
        type: 'quality',
        value: [80]
      }];
      mockRequest.headers = { 'dit-dpr': '2' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(0);
    });

    it('should not optimize quality when quality output is missing', () => {
      mockPolicy.outputs = [{ type: 'format', value: 'auto' }];
      mockRequest.headers = { 'dit-dpr': '2' };
      
      const result = applyAutoOptimizations(baseTransformations, mockRequest as Request, mockPolicy);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('format');
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
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('format');
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