// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { evaluateConditionals } from './conditional-evaluator';
import { Transformation, TransformationConditional } from '../../../types/transformation';

describe('evaluateConditionals', () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      get: jest.fn()
    };
  });

  describe('equals operator', () => {
    it('should evaluate equals condition correctly', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('image/webp');
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'equals',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(mockRequest.get).toHaveBeenCalledWith('dit-accept');
      expect(result).toHaveLength(1);
    });

    it('should handle case-sensitive comparison', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('image/webp');
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'equals',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(1);
    });

    it('should handle string comparison', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('2');
      
      const transformations: Transformation[] = [{
        type: 'quality',
        value: 80,
        source: 'policy',
        conditional: {
          target: 'dpr',
          operator: 'equals',
          value: '2'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(1);
    });

    it('should exclude transformation when equals condition fails', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('image/jpeg');
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'equals',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(0);
    });

    it('should handle missing headers gracefully', () => {
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'equals',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('isIn operator', () => {
    it('should evaluate isIn condition with exact match', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('image/webp');
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'isIn',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(1);
    });

    it('should handle array of expected values', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('mobile');
      
      const transformations: Transformation[] = [{
        type: 'quality',
        value: 70,
        source: 'policy',
        conditional: {
          target: 'user-agent',
          operator: 'isIn',
          value: ['mobile', 'tablet']
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(1);
    });

    it('should exclude transformation when isIn condition fails', () => {
      (mockRequest.get as jest.Mock).mockReturnValue('desktop');
      
      const transformations: Transformation[] = [{
        type: 'quality',
        value: 70,
        source: 'policy',
        conditional: {
          target: 'user-agent',
          operator: 'isIn',
          value: ['mobile', 'tablet']
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle unsupported target gracefully', () => {
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'unsupported.field',
          operator: 'equals',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(0);
    });

    it('should handle unsupported operators', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'unsupported' as any,
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(consoleSpy).toHaveBeenCalledWith('Unsupported conditional operator: unsupported');
      expect(result).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('should handle request errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (mockRequest.get as jest.Mock).mockImplementation(() => {
        throw new Error('Request error');
      });
      
      const transformations: Transformation[] = [{
        type: 'format',
        value: 'webp',
        source: 'policy',
        conditional: {
          target: 'dit-accept',
          operator: 'equals',
          value: 'image/webp'
        }
      }];
      
      const result = evaluateConditionals(transformations, mockRequest as Request);
      
      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});