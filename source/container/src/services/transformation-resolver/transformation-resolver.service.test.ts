// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { TransformationResolverService } from './transformation-resolver.service';
import { PolicyCache } from '../cache/domain/policy-cache';
import { CacheRegistry } from '../cache/cache-registry';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { Transformation, TransformationPolicy } from '../../types/transformation';
import { PolicyNotFoundError } from './errors/policy-not-found.error';

// Custom interface for test mocks to allow parsed query parameter types
interface TestRequest extends Omit<Request, 'query'> {
  query: Record<string, any>;
}

describe('TransformationResolverService', () => {
  let service: TransformationResolverService;
  let mockPolicyCache: jest.Mocked<PolicyCache>;
  let mockRequest: Partial<TestRequest>;
  let mockImageRequest: ImageProcessingRequest;

  beforeEach(() => {
    const defaultPolicy: TransformationPolicy = {
      policyId: 'default-policy',
      policyName: 'Default Policy',
      transformations: [{
        type: 'quality',
        value: 75,
        source: 'policy'
      }],
      isDefault: true
    };
    
    mockPolicyCache = {
      getPolicy: jest.fn(),
      getDefault: jest.fn().mockResolvedValue(defaultPolicy)
    } as any;

    service = new TransformationResolverService(mockPolicyCache);

    mockRequest = {
      query: {},
      headers: {},
      get: jest.fn()
    };

    mockImageRequest = {
      requestId: 'test-request-id',
      timestamp: Date.now(),
      response: {
        headers: {}
      }
    };
  });

  describe('resolve', () => {
    it('should resolve transformations without policy ID, provided there is a default policy defined', async () => {
      mockRequest.query = { 'resize.width': 300, 'format': 'webp' };
      
      await service.resolve(mockRequest as TestRequest, mockImageRequest);
      
      console.log(mockImageRequest.transformations);
      expect(mockImageRequest.transformations).toHaveLength(3);
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('resize');
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('format');
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('quality');
    });

    it('should resolve transformations with valid policy ID', async () => {
      const mockPolicy: TransformationPolicy = {
        policyId: 'test-policy',
        policyName: 'Test Policy',
        transformations: [{
          type: 'quality',
          value: 85,
          source: 'policy'
        }],
        isDefault: false
      };
      
      mockPolicyCache.getPolicy.mockResolvedValue(mockPolicy);
      mockImageRequest.policy = { id: 'test-policy' };
      mockRequest.query = { 'resize.width': 300 };
      
      await service.resolve(mockRequest as TestRequest, mockImageRequest);
      
      expect(mockImageRequest.transformations).toHaveLength(2);
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('resize');
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('quality');
    });



    it('should apply precedence rules correctly', async () => {
      const mockPolicy: TransformationPolicy = {
        policyId: 'test-policy',
        policyName: 'Test Policy',
        transformations: [{
          type: 'quality',
          value: 90,
          source: 'policy'
        }],
        isDefault: false
      };
      
      mockPolicyCache.getPolicy.mockResolvedValue(mockPolicy);
      mockImageRequest.policy = { id: 'test-policy' };
      mockRequest.query = { 'quality': 80 }; // URL quality should override policy
      
      await service.resolve(mockRequest as TestRequest, mockImageRequest);
      
      expect(mockImageRequest.transformations).toHaveLength(1);
      expect(mockImageRequest.transformations![0].value).toBe(80); // URL value wins
      expect(mockImageRequest.transformations![0].source).toBe('url');
    });

    it('should enforce transformation limits', async () => {
      // Create many URL transformations to test limit enforcement
      mockRequest.query = {
        'resize.width': 300,
        'resize.height': 200,
        'format': 'webp',
        'quality': 80,
        'rotate': 90,
        'flip': true
      };
      
      // Mock many policy transformations
      const manyTransformations = Array.from({ length: 10 }, (_, i) => ({
        type: `policy${i}`,
        value: i,
        source: 'policy' as const
      }));
      
      const mockPolicy: TransformationPolicy = {
        policyId: 'test-policy',
        policyName: 'Test Policy',
        transformations: manyTransformations,
        isDefault: false
      };
      
      mockPolicyCache.getPolicy.mockResolvedValue(mockPolicy);
      mockImageRequest.policy = { id: 'test-policy' };
      
      await service.resolve(mockRequest as TestRequest, mockImageRequest);
      
      expect(mockImageRequest.transformations!.length).toBeLessThanOrEqual(10);
    });
  });

  describe('policy resolution', () => {
    it('should use default policy when no policy ID provided', async () => {
      mockRequest.query = { 'resize.width': 300 };
      
      await service.resolve(mockRequest as TestRequest, mockImageRequest);
      
      expect(mockPolicyCache.getDefault).toHaveBeenCalled();
      expect(mockImageRequest.transformations).toHaveLength(2);
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('resize');
      expect(mockImageRequest.transformations!.map(t => t.type)).toContain('quality');
      expect(mockImageRequest.transformations!.find(t => t.type === 'quality')!.source).toBe('policy');
    });

    it('should return transformations from cached policy', async () => {
      const mockPolicy: TransformationPolicy = {
        policyId: 'test-policy',
        policyName: 'Test Policy',
        transformations: [{
          type: 'format',
          value: 'webp',
          source: 'policy'
        }],
        isDefault: false
      };
      
      mockPolicyCache.getPolicy.mockResolvedValue(mockPolicy);
      mockImageRequest.policy = { id: 'test-policy' };
      
      await service.resolve(mockRequest as TestRequest, mockImageRequest);
      
      expect(mockPolicyCache.getPolicy).toHaveBeenCalledWith('test-policy');
      expect(mockImageRequest.transformations!.some(t => t.type === 'format')).toBe(true);
    });

    it('should throw PolicyNotFoundError when policyId provided but policy not found', async () => {
      mockPolicyCache.getPolicy.mockResolvedValue(null);
      mockRequest.query = { 'policyId': 'nonexistent-policy', 'resize.width': 300 };
      
      await expect(service.resolve(mockRequest as TestRequest, mockImageRequest))
        .rejects.toThrow(PolicyNotFoundError);
    });
  });

  describe('negotiated auto-format marker', () => {
    const autoFormatPolicy = (outputFormat: string): TransformationPolicy => ({
      policyId: 'auto-format-policy',
      policyName: 'Auto Format Policy',
      transformations: [],
      outputs: [{ type: 'format', value: outputFormat }],
      isDefault: false
    });

    beforeEach(() => {
      const headers: Record<string, string> = { 'dit-accept': 'image/jpeg' };
      mockRequest.headers = headers;
      (mockRequest as any).header = jest.fn((name: string) => headers[name.toLowerCase()]);
      mockImageRequest.policy = { id: 'auto-format-policy' };
    });

    it('should mark a policy auto format as negotiated', async () => {
      mockPolicyCache.getPolicy.mockResolvedValue(autoFormatPolicy('auto'));

      await service.resolve(mockRequest as TestRequest, mockImageRequest);

      expect(mockImageRequest.transformations).toEqual([
        { type: 'format', value: 'jpeg', source: 'auto', negotiated: true }
      ]);
    });

    it('should drop the negotiated marker when a URL format overrides policy auto format', async () => {
      mockPolicyCache.getPolicy.mockResolvedValue(autoFormatPolicy('auto'));
      mockRequest.query = { format: 'jpeg' };

      await service.resolve(mockRequest as TestRequest, mockImageRequest);

      const formats = mockImageRequest.transformations!.filter(t => t.type === 'format');
      expect(formats).toHaveLength(1);
      expect(formats[0].source).toBe('url');
      expect(formats[0].negotiated).toBeUndefined();
    });

    it('should not mark a static policy output format as negotiated', async () => {
      mockPolicyCache.getPolicy.mockResolvedValue(autoFormatPolicy('jpeg'));

      await service.resolve(mockRequest as TestRequest, mockImageRequest);

      const formats = mockImageRequest.transformations!.filter(t => t.type === 'format');
      expect(formats).toHaveLength(1);
      expect(formats[0].negotiated).toBeUndefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      // Mock CacheRegistry to avoid cache initialization issues
      const mockCacheRegistry = {
        getPolicyCache: jest.fn().mockReturnValue(mockPolicyCache)
      };
      jest.spyOn(CacheRegistry, 'getInstance').mockReturnValue(mockCacheRegistry as any);
      
      const instance1 = TransformationResolverService.getInstance();
      const instance2 = TransformationResolverService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});