// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RequestResolverService } from './request-resolver.service';
import { ValidationError } from './errors/validation.error';
import { OriginNotFoundError } from './errors/origin-not-found.error';
import { MappingResolver } from './mapping-resolver/mapping-resolver';
import { OriginResolver } from './origin-resolver/origin-resolver';
import { RequestValidator } from './validation/request-validator';
import { ConnectionManager } from './connection-manager/connection-manager';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { ImageProcessingError } from '../image-processing/types';

// Mock the dependencies
jest.mock('./mapping-resolver/mapping-resolver');
jest.mock('./origin-resolver/origin-resolver');
jest.mock('./validation/request-validator');
jest.mock('./connection-manager/connection-manager');

describe('RequestResolverService', () => {
  let service: RequestResolverService;
  let mockMappingResolver: jest.Mocked<MappingResolver>;
  let mockOriginResolver: jest.Mocked<OriginResolver>;
  let mockRequestValidator: jest.Mocked<RequestValidator>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockMappingResolver = {
      resolve: jest.fn()
    } as any;
    
    mockOriginResolver = {
      resolve: jest.fn()
    } as any;
    
    mockRequestValidator = {
      validateRequest: jest.fn()
    } as any;
    
    mockConnectionManager = {
      fetchOriginImage: jest.fn()
    } as any;

    // Create service instance with mocked dependencies
    service = new RequestResolverService(
      mockMappingResolver,
      mockOriginResolver,
      mockRequestValidator,
      mockConnectionManager
    );
  });

  it('should resolve requests successfully with path mapping', async () => {
    const mockReq = {
      path: '/images/test.jpg',
      get: jest.fn().mockReturnValue('example.com')
    } as any;

    const imageRequest: ImageProcessingRequest = {
      requestId: 'test-123',
      timestamp: Date.now(),
      response: { headers: {} }
    };

    const pathMapping = { pathPattern: '/images/*', originId: 'origin-1' };
    const origin = {
      originId: 'origin-1',
      originName: 'test-origin',
      originDomain: 'https://test-bucket.s3.amazonaws.com'
    };

    const mappingResult = {
      pathMatch: pathMapping,
      hostMatch: undefined,
      selectedMapping: pathMapping,
      resolvedBy: 'path' as const
    };

    mockRequestValidator.validateRequest.mockReturnValue(undefined);
    mockMappingResolver.resolve.mockResolvedValue(mappingResult);
    mockOriginResolver.resolve.mockResolvedValue(origin);
    mockConnectionManager.fetchOriginImage.mockResolvedValue(undefined);

    await service.resolve(mockReq, imageRequest);

    expect(imageRequest.origin?.url).toBe('https://test-bucket.s3.amazonaws.com/images/test.jpg');
  });

  describe('origin fetch boundary', () => {
    const req = { path: '/images/test.jpg', get: jest.fn().mockReturnValue('example.com') } as any;
    const mappingResult = {
      pathMatch: { pathPattern: '/images/*', originId: 'origin-1' },
      hostMatch: undefined,
      selectedMapping: { pathPattern: '/images/*', originId: 'origin-1' },
      resolvedBy: 'path' as const
    };
    const origin = {
      originId: 'origin-1',
      originName: 'test-origin',
      originDomain: 'https://assets.example.com',
      originHeaders: { 'x-origin-key': 'secret' }
    };
    const newRequest = (): ImageProcessingRequest => ({ requestId: 'test-123', timestamp: Date.now(), response: { headers: {} } });

    beforeEach(() => {
      mockMappingResolver.resolve.mockResolvedValue(mappingResult as any);
      mockOriginResolver.resolve.mockResolvedValue(origin as any);
    });

    it('passes the resolved origin headers to the origin fetch', async () => {
      mockConnectionManager.fetchOriginImage.mockResolvedValue(undefined);
      const imageRequest = newRequest();

      await service.resolve(req, imageRequest);

      expect(mockConnectionManager.fetchOriginImage).toHaveBeenCalledWith(
        'https://assets.example.com/images/test.jpg',
        imageRequest,
        { 'x-origin-key': 'secret' }
      );
      expect(imageRequest.origin?.headers).toEqual({ 'x-origin-key': 'secret' });
    });

    it('rethrows an ImageProcessingError from the origin fetch unchanged', async () => {
      const timeout = new ImageProcessingError(504, 'RequestTimeout', 'Origin request timeout', 'body read exceeded 30000ms');
      mockConnectionManager.fetchOriginImage.mockRejectedValue(timeout);

      await expect(service.resolve(req, newRequest())).rejects.toBe(timeout);
    });
  });

  it('should throw ValidationError for invalid requests', async () => {
    const mockReq = {
      path: 'invalid-path',
      get: jest.fn().mockReturnValue('example.com')
    } as any;

    const imageRequest: ImageProcessingRequest = {
      requestId: 'test-123',
      timestamp: Date.now(),
      response: { headers: {} }
    };

    mockRequestValidator.validateRequest.mockImplementation(() => {
      throw new ValidationError('Invalid request path');
    });

    await expect(service.resolve(mockReq, imageRequest)).rejects.toThrow(ValidationError);
  });

  it('should throw OriginNotFoundError when no mappings match', async () => {
    const mockReq = {
      path: '/unknown/path',
      get: jest.fn().mockReturnValue('unknown.com')
    } as any;

    const imageRequest: ImageProcessingRequest = {
      requestId: 'test-123',
      timestamp: Date.now(),
      response: { headers: {} }
    };

    mockRequestValidator.validateRequest.mockReturnValue(undefined);
    mockMappingResolver.resolve.mockRejectedValue(new OriginNotFoundError('No matching origin found'));

    await expect(service.resolve(mockReq, imageRequest)).rejects.toThrow(OriginNotFoundError);
  });

  it('should handle host header mapping fallback', async () => {
    const mockReq = {
      path: '/unknown/path',
      get: jest.fn().mockReturnValue('example.com')
    } as any;

    const imageRequest: ImageProcessingRequest = {
      requestId: 'test-123',
      timestamp: Date.now(),
      response: { headers: {} }
    };

    const hostMapping = { hostPattern: 'example.com', originId: 'origin-2' };
    const origin = {
      originId: 'origin-2',
      originName: 'external-origin',
      originDomain: 'https://external.example.com'
    };

    const mappingResult = {
      pathMatch: undefined,
      hostMatch: hostMapping,
      selectedMapping: hostMapping,
      resolvedBy: 'host' as const
    };

    mockRequestValidator.validateRequest.mockReturnValue(undefined);
    mockMappingResolver.resolve.mockResolvedValue(mappingResult);
    mockOriginResolver.resolve.mockResolvedValue(origin);
    mockConnectionManager.fetchOriginImage.mockResolvedValue(undefined);

    await service.resolve(mockReq, imageRequest);

    expect(imageRequest.origin?.url).toBe('https://external.example.com/unknown/path');
  });

  describe('Custom Header Override', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use custom header when CUSTOM_ORIGIN_HEADER is set', async () => {
      process.env.CUSTOM_ORIGIN_HEADER = 'x-custom-origin';
      
      const mockReq = {
        path: '/images/test.jpg',
        headers: { 'x-custom-origin': 'https://custom.example.com' }
      } as any;

      const imageRequest: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        response: { headers: {} }
      };

      mockRequestValidator.validateRequest.mockReturnValue(undefined);
      mockConnectionManager.fetchOriginImage.mockResolvedValue(undefined);

      await service.resolve(mockReq, imageRequest);

      expect(imageRequest.origin?.url).toBe('https://custom.example.com/images/test.jpg');
      expect(imageRequest.policy).toBeNull();
      expect(mockMappingResolver.resolve).not.toHaveBeenCalled();
      expect(mockOriginResolver.resolve).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid custom origin URL', async () => {
      process.env.CUSTOM_ORIGIN_HEADER = 'x-custom-origin';
      
      const mockReq = {
        path: '/images/test.jpg',
        headers: { 'x-custom-origin': 'invalid-url' }
      } as any;

      const imageRequest: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        response: { headers: {} }
      };

      mockRequestValidator.validateRequest.mockReturnValue(undefined);

      await expect(service.resolve(mockReq, imageRequest)).rejects.toThrow(ValidationError);
    });

    it('should use normal flow when custom header not present', async () => {
      process.env.CUSTOM_ORIGIN_HEADER = 'x-custom-origin';
      
      const mockReq = {
        path: '/images/test.jpg',
        headers: {},
        get: jest.fn().mockReturnValue('example.com')
      } as any;

      const imageRequest: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        response: { headers: {} }
      };

      const pathMapping = { pathPattern: '/images/*', originId: 'origin-1' };
      const origin = {
        originId: 'origin-1',
        originName: 'test-origin',
        originDomain: 'https://test-bucket.s3.amazonaws.com'
      };

      const mappingResult = {
        pathMatch: pathMapping,
        hostMatch: undefined,
        selectedMapping: pathMapping,
        resolvedBy: 'path' as const
      };

      mockRequestValidator.validateRequest.mockReturnValue(undefined);
      mockMappingResolver.resolve.mockResolvedValue(mappingResult);
      mockOriginResolver.resolve.mockResolvedValue(origin);
      mockConnectionManager.fetchOriginImage.mockResolvedValue(undefined);

      await service.resolve(mockReq, imageRequest);

      expect(mockMappingResolver.resolve).toHaveBeenCalled();
      expect(mockOriginResolver.resolve).toHaveBeenCalled();
    });
  });
});