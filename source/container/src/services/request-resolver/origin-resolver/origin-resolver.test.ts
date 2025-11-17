// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginResolver } from './origin-resolver';
import { OriginNotFoundError } from '../errors/origin-not-found.error';
import { OriginCache, OriginConfiguration } from '../../cache/domain/origin-cache';
import { PathMapping } from '../../cache/domain/path-mapping-cache';
import { HeaderMapping } from '../../cache/domain/header-mapping-cache';

describe('OriginResolver', () => {
  let originResolver: OriginResolver;
  let mockOriginCache: jest.Mocked<OriginCache>;

  beforeEach(() => {
    mockOriginCache = {
      getOrigin: jest.fn(),
      cacheOrigin: jest.fn(),
      invalidateOrigin: jest.fn(),
      getContents: jest.fn(),
      size: jest.fn(),
      warmCache: jest.fn()
    } as Partial<OriginCache> as jest.Mocked<OriginCache>;
    
    originResolver = new OriginResolver(mockOriginCache);
  });

  describe('resolve', () => {
    const validOrigin: OriginConfiguration = {
      originId: 'origin-123',
      originName: 'Test Origin',
      originDomain: 'https://example.com'
    };

    it('should resolve valid PathMapping', async () => {
      const mapping: PathMapping = { 
        pathPattern: '/images/*',
        originId: 'origin-123' 
      };
      mockOriginCache.getOrigin.mockResolvedValue(validOrigin);

      const result = await originResolver.resolve(mapping);

      expect(result).toEqual(validOrigin);
      expect(mockOriginCache.getOrigin).toHaveBeenCalledWith('origin-123');
    });

    it('should resolve valid HeaderMapping', async () => {
      const mapping: HeaderMapping = { 
        hostPattern: '*.example.com',
        originId: 'origin-456' 
      };
      mockOriginCache.getOrigin.mockResolvedValue(validOrigin);

      const result = await originResolver.resolve(mapping);

      expect(result).toEqual(validOrigin);
      expect(mockOriginCache.getOrigin).toHaveBeenCalledWith('origin-456');
    });

    it('should throw error when origin not found in cache', async () => {
      const mapping: PathMapping = { 
        pathPattern: '/missing/*',
        originId: 'missing-origin' 
      };
      mockOriginCache.getOrigin.mockResolvedValue(null);

      await expect(originResolver.resolve(mapping)).rejects.toThrow(
        new OriginNotFoundError('The Origin specified does not exist')
      );
    });

    it('should throw error when origin missing originName', async () => {
      const mapping: PathMapping = { 
        pathPattern: '/test/*',
        originId: 'origin-123' 
      };
      const invalidOrigin = { originId: 'origin-123', originDomain: 'https://example.com' } as OriginConfiguration;
      mockOriginCache.getOrigin.mockResolvedValue(invalidOrigin);

      await expect(originResolver.resolve(mapping)).rejects.toThrow(
        new OriginNotFoundError('Invalid origin configuration')
      );
    });

    it('should throw error when origin missing originDomain', async () => {
      const mapping: PathMapping = { 
        pathPattern: '/test/*',
        originId: 'origin-123' 
      };
      const invalidOrigin = { originId: 'origin-123', originName: 'Test' } as OriginConfiguration;
      mockOriginCache.getOrigin.mockResolvedValue(invalidOrigin);

      await expect(originResolver.resolve(mapping)).rejects.toThrow(
        new OriginNotFoundError('Invalid origin configuration')
      );
    });

    it('should throw error when origin has invalid domain URL', async () => {
      const mapping: PathMapping = { 
        pathPattern: '/test/*',
        originId: 'origin-123' 
      };
      const invalidOrigin: OriginConfiguration = {
        originId: 'origin-123',
        originName: 'Test Origin',
        originDomain: 'not a valid url'
      };
      mockOriginCache.getOrigin.mockResolvedValue(invalidOrigin);

      await expect(originResolver.resolve(mapping)).rejects.toThrow(OriginNotFoundError);
      await expect(originResolver.resolve(mapping)).rejects.toThrow('Invalid origin domain');
    });

    it('should throw error when mapping has undefined originId', async () => {
      const mapping = {} as PathMapping;

      await expect(originResolver.resolve(mapping)).rejects.toThrow(
        new OriginNotFoundError('The Origin specified does not exist')
      );
    });

    it('should prepend https:// to origin domain without protocol', async () => {
      const mapping: PathMapping = { 
        pathPattern: '/test/*',
        originId: 'origin-123' 
      };
      const originWithoutProtocol: OriginConfiguration = {
        originId: 'origin-123',
        originName: 'Test Origin',
        originDomain: 'example.com'
      };
      mockOriginCache.getOrigin.mockResolvedValue(originWithoutProtocol);

      const result = await originResolver.resolve(mapping);

      expect(result.originDomain).toBe('https://example.com');
    });

    it('should not modify origin domain with existing protocol', async () => {
      const protocols = ['http://'];
      
      for (const protocol of protocols) {
        const mapping: PathMapping = { 
          pathPattern: '/test/*',
          originId: 'origin-123' 
        };
        const originWithProtocol: OriginConfiguration = {
          originId: 'origin-123',
          originName: 'Test Origin',
          originDomain: `${protocol}example.com`
        };
        mockOriginCache.getOrigin.mockResolvedValue(originWithProtocol);

        const result = await originResolver.resolve(mapping);

        expect(result.originDomain).toBe(`${protocol}example.com`);
      }
    });
  });
});