// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageProcessorService } from '../../../../src/services/image-processing/image-processor.service';
import { ImageProcessingRequest } from '../../../../src/types/image-processing-request';
import { Transformation } from '../../../../src/types/transformation';
import { CacheRegistry } from '../../../../src/services/cache/cache-registry';
import { OriginCache } from '../../../../src/services/cache/domain/origin-cache';
import { TestHttpServer } from '../../setup/test-http-server';
import sharp from 'sharp';

// Mock AWS services for integration testing
jest.mock('@aws-sdk/client-s3');

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

const s3Mock = mockClient(S3Client);

describe('ImageProcessorService Integration Tests', () => {
  let imageProcessor: ImageProcessorService;
  let testServer: TestHttpServer;
  let serverUrl: string;

  beforeAll(async () => {
    testServer = new TestHttpServer();
    serverUrl = await testServer.start();
  });

  afterAll(async () => {
    await testServer.stop();
  });

  beforeEach(async () => {
    CacheRegistry.getInstance().clear();
    imageProcessor = ImageProcessorService.getInstance();
    s3Mock.reset();
    await initializeOriginCache();
  });

  const createImageRequest = (transformations?: Transformation[], contentType = 'image/jpeg'): ImageProcessingRequest => ({
    requestId: 'test-request',
    timestamp: Date.now(),
    origin: { url: `${serverUrl}/test.jpg`, headers: {} },
    transformations,
    sourceImageContentType: contentType,
    response: { headers: {} }
  });

  const initializeOriginCache = async () => {
    const originCache = new OriginCache();
    CacheRegistry.getInstance().register('origin', originCache);
    await originCache.cacheOrigin({
      originId: 'test-origin',
      originName: 'test-origin',
      originDomain: 'http://localhost',
      originPath: '/'
    });
  };

  describe('Pipeline Orchestration', () => {
    test('should process image without transformations', async () => {
      const request = createImageRequest();
      const result = await imageProcessor.process(request);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(request.response.contentType).toBe('image/jpeg');
    });

    test('should process image with resize transformation', async () => {
      const transformations: Transformation[] = [
        { type: 'resize', value: { width: 400 }, source: 'url' }
      ];
      const request = createImageRequest(transformations);
      const result = await imageProcessor.process(request);
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should resolve content type from final processed image', async () => {
      const transformations: Transformation[] = [
        { type: 'format', value: 'webp', source: 'url' }
      ];
      const request = createImageRequest(transformations);
      await imageProcessor.process(request);

      expect(request.response.contentType).toBe('image/webp');
    });
  });

  describe('Animated Image Handling', () => {
    test('should handle animated GIF processing pipeline', async () => {
      const request = createImageRequest([
        { type: 'resize', value: { width: 50 }, source: 'url' }
      ], 'image/gif');
      request.origin.url = `${serverUrl}/test.gif`;
      
      const result = await imageProcessor.process(request);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(request.response.contentType).toBe('image/gif');
    });
  });

  describe('Metadata Preservation', () => {
    test('should replace EXIF with DIT software tag when stripping', async () => {
      // First get original EXIF size
      const originalRequest = createImageRequest();
      const originalResult = await imageProcessor.process(originalRequest);
      const originalMetadata = await sharp(originalResult).metadata();
      const originalExifSize = originalMetadata.exif?.length || 0;
      
      // Then test with EXIF stripping
      const transformations: Transformation[] = [
        { type: 'stripExif', value: true, source: 'url' }
      ];
      const request = createImageRequest(transformations);
      const result = await imageProcessor.process(request);
      
      const metadata = await sharp(result).metadata();
      expect(metadata.exif).toBeDefined();
      expect(Buffer.isBuffer(metadata.exif)).toBe(true);
      // EXIF should be significantly smaller after stripping
      expect(metadata.exif.length).toBeLessThan(originalExifSize);
    });

    test('should preserve EXIF data when not stripping', async () => {
      const request = createImageRequest();
      const result = await imageProcessor.process(request);
      
      const metadata = await sharp(result).metadata();
      expect(metadata.exif).toBeDefined();
    });

    test('should convert to sRGB color space when stripping ICC', async () => {
      const transformations: Transformation[] = [
        { type: 'stripIcc', value: true, source: 'url' }
      ];
      const request = createImageRequest(transformations);
      const result = await imageProcessor.process(request);
      
      const metadata = await sharp(result).metadata();
      expect(metadata.icc).toBeDefined();
      expect(metadata.space).toBe('srgb');
    });
  });

  describe('Origin Fetching Integration', () => {
    test('should fetch different image formats', async () => {
      const pngRequest = createImageRequest([], 'image/png');
      pngRequest.origin.url = `${serverUrl}/test.png`;
      const result = await imageProcessor.process(pngRequest);
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });


  });

  describe('Pipeline Error Handling', () => {
    test('should handle HTTP 404 errors', async () => {
      const request = createImageRequest();
      request.origin.url = `${serverUrl}/404`;

      await expect(imageProcessor.process(request)).rejects.toThrow();
    });

    test('should handle HTTP 500 errors', async () => {
      const request = createImageRequest();
      request.origin.url = `${serverUrl}/500`;

      await expect(imageProcessor.process(request)).rejects.toThrow();
    });

    test('should handle invalid content type', async () => {
      const request = createImageRequest();
      request.origin.url = `${serverUrl}/invalid-content-type`;

      await expect(imageProcessor.process(request)).rejects.toThrow('Invalid content type');
    });



    test('should propagate transformation engine errors', async () => {
      const transformations: Transformation[] = [
        { type: 'resize', value: { width: -100 }, source: 'url' }
      ];
      const request = createImageRequest(transformations);

      await expect(imageProcessor.process(request)).rejects.toThrow();
    });

    test('should handle invalid format transformation', async () => {
      const transformations: Transformation[] = [
        { type: 'format', value: 'invalid-format', source: 'url' }
      ];
      const request = createImageRequest(transformations);

      await expect(imageProcessor.process(request)).rejects.toThrow();
    });
  });

  describe('Content Type Resolution', () => {
    test('should resolve HEIF content type', async () => {
      const transformations: Transformation[] = [
        { type: 'format', value: 'heif', source: 'url' }
      ];
      const request = createImageRequest(transformations);
      await imageProcessor.process(request);
      
      expect(request.response.contentType).toBe('image/heif');
    });

    test('should resolve WebP content type', async () => {
      const transformations: Transformation[] = [
        { type: 'format', value: 'webp', source: 'url' }
      ];
      const request = createImageRequest(transformations);
      await imageProcessor.process(request);
      
      expect(request.response.contentType).toBe('image/webp');
    });
  });

  describe('Complex Transformation Chains', () => {
    test('should process resize → format → quality chain', async () => {
      const transformations: Transformation[] = [
        { type: 'resize', value: { width: 300, height: 200 }, source: 'url' },
        { type: 'format', value: 'png', source: 'url' },
        { type: 'quality', value: 90, source: 'url' }
      ];
      const request = createImageRequest(transformations);
      const result = await imageProcessor.process(request);
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(request.response.contentType).toBe('image/png');
    });

    test('should process crop → resize → format chain with deferred resize', async () => {
      const transformations: Transformation[] = [
        { type: 'extract', value: [0, 0, 200, 200], source: 'url' },
        { type: 'resize', value: { width: 100 }, source: 'url' },
        { type: 'format', value: 'webp', source: 'url' }
      ];
      const request = createImageRequest(transformations);
      const result = await imageProcessor.process(request);
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(request.response.contentType).toBe('image/webp');
    });

    test('should process complex transformation with metadata operations', async () => {
      const transformations: Transformation[] = [
        { type: 'stripExif', value: true, source: 'url' },
        { type: 'resize', value: { width: 200 }, source: 'url' },
        { type: 'sharpen', value: true, source: 'url' },
        { type: 'format', value: 'png', source: 'url' }
      ];
      const request = createImageRequest(transformations);
      const result = await imageProcessor.process(request);
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(request.response.contentType).toBe('image/png');
    });
  });
});