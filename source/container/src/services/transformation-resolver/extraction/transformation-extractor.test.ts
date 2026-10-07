// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { extractUrlTransformations } from './transformation-extractor';
import { TransformationMapper } from '../../image-processing/transformation-engine/transformation-mapper';

// Custom interface for test mocks to allow parsed query parameter types
interface TestRequest extends Omit<Request, 'query'> {
  query: Record<string, any>;
}

describe('extractUrlTransformations', () => {
  let mockRequest: Partial<TestRequest>;

  beforeEach(() => {
    mockRequest = {
      query: {},
      headers: {}
    };
  });

  describe('parameter mapping and processing', () => {
    it('should process flat parameters through complete pipeline', () => {
      mockRequest.query = { 'quality': 85 };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'quality',
        value: 85,
        source: 'url'
      });
    });

    it('should process nested parameters through complete pipeline', () => {
      mockRequest.query = { 'resize.width': 300, 'resize.height': 200 };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'resize',
        value: { width: 300, height: 200 },
        source: 'url'
      });
    });

    it('should ignore unknown parameters', () => {
      mockRequest.query = { 'resize.width': 300, unknown_param: 'value', invalid: 'param' };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('resize');
    });

    it('should reject invalid values that fail schema validation', () => {
      mockRequest.query = { quality: '150' }; // exceeds max value
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(0);
    });

    it('should reject non-numeric values for numeric params', () => {
      mockRequest.query = { 'resize.width': 'invalid' };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('multiple transformation handling', () => {
    it('should process multiple transformations independently', () => {
      mockRequest.query = { 'resize.width': 300, quality: 80, format: 'webp' };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(3);
      expect(result.map(t => t.type)).toEqual(expect.arrayContaining(['resize', 'quality', 'format']));
    });

    it('should isolate validation failures', () => {
      mockRequest.query = { 'resize.width': 300, quality: 150, format: 'webp' }; // quality invalid
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.type)).toEqual(expect.arrayContaining(['resize', 'format']));
      expect(result.map(t => t.type)).not.toContain('quality');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query parameters', () => {
      mockRequest.query = {};
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(0);
    });

    it('should handle null and undefined values', () => {
      mockRequest.query = { 'resize.width': null, 'resize.height': undefined, format: '' };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      expect(result).toHaveLength(0);
    });

    it('should set source as url for all transformations', () => {
      mockRequest.query = { 'resize.width': 300, quality: '80' };
      
      const result = extractUrlTransformations(mockRequest as Request, 'test-123');
      
      result.forEach(transformation => {
        expect(transformation.source).toBe('url');
      });
    });
  });

  // jpg is normalized to jpeg at mapping time (SharpUtils.convertImageFormatType), not at extraction.
  describe('format aliases', () => {
    it.each(['jpeg', 'jpg'])('should accept format=%s unchanged', (format) => {
      mockRequest.query = { format };

      const result = extractUrlTransformations(mockRequest as Request, 'test-123');

      expect(result).toEqual([{ type: 'format', value: format, source: 'url' }]);
    });

    it.each(['jpeg', 'jpg'])('should map URL format=%s to jpeg output', async (format) => {
      mockRequest.query = { format };

      const edits = await TransformationMapper.mapToImageEdits(
        extractUrlTransformations(mockRequest as Request, 'test-123')
      );

      expect(edits.toFormat).toBe('jpeg');
    });
  });
});