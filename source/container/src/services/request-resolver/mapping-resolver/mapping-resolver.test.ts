// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MappingResolver } from './mapping-resolver';
import { OriginNotFoundError } from '../errors/origin-not-found.error';

describe('MappingResolver', () => {
  let mappingResolver: MappingResolver;
  let mockPathCache: any;
  let mockHeaderCache: any;

  beforeEach(() => {
    mockPathCache = {
      findBestMatch: jest.fn()
    };
    mockHeaderCache = {
      findBestMatch: jest.fn()
    };
    mappingResolver = new MappingResolver(mockPathCache, mockHeaderCache);
  });

  it('should prioritize host header mapping over path mapping', async () => {
    const mockReq = {
      path: '/images/test.jpg',
      get: jest.fn().mockReturnValue('example.com')
    } as any;

    const hostMapping = { hostPattern: 'example.com', originId: 'host-origin' };
    const pathMapping = { pathPattern: '/images/*', originId: 'path-origin' };

    mockHeaderCache.findBestMatch.mockResolvedValue(hostMapping);
    mockPathCache.findBestMatch.mockResolvedValue(pathMapping);

    const mockImageRequest = { requestId: 'test-123' } as any;
    const result = await mappingResolver.resolve(mockReq, mockImageRequest);

    expect(result.selectedMapping).toBe(hostMapping);
    expect(result.resolvedBy).toBe('host');
    expect(result.hostMatch).toBe(hostMapping);
    expect(result.pathMatch).toBeUndefined();
    expect(mockPathCache.findBestMatch).not.toHaveBeenCalled();
  });

  it('should use path mapping when host header mapping fails', async () => {
    const mockReq = {
      path: '/images/test.jpg',
      get: jest.fn().mockReturnValue('unknown.com')
    } as any;

    const pathMapping = { pathPattern: '/images/*', originId: 'path-origin' };

    mockHeaderCache.findBestMatch.mockResolvedValue(null);
    mockPathCache.findBestMatch.mockResolvedValue(pathMapping);

    const mockImageRequest = { requestId: 'test-123' } as any;
    const result = await mappingResolver.resolve(mockReq, mockImageRequest);

    expect(result.selectedMapping).toBe(pathMapping);
    expect(result.resolvedBy).toBe('path');
    expect(result.pathMatch).toBe(pathMapping);
    expect(result.hostMatch).toBeUndefined();
  });

  it('should throw OriginNotFoundError when no mappings match', async () => {
    const mockReq = {
      path: '/unknown/path',
      get: jest.fn().mockReturnValue('unknown.com')
    } as any;

    mockHeaderCache.findBestMatch.mockResolvedValue(null);
    mockPathCache.findBestMatch.mockResolvedValue(null);

    const mockImageRequest = { requestId: 'test-123' } as any;
    await expect(mappingResolver.resolve(mockReq, mockImageRequest)).rejects.toThrow(OriginNotFoundError);
    await expect(mappingResolver.resolve(mockReq, mockImageRequest)).rejects.toThrow('Unable to resolve an origin');
  });
});