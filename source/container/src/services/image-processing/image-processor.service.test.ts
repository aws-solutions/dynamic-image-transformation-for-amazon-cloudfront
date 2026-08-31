// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageProcessorService } from './image-processor.service';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { EditApplicator } from './transformation-engine/edit-applicator';
import { ErrorMapper } from './utils/error-mapping';
import { ImageProcessingError } from './types';
import sharp from 'sharp';

let TEST_JPEG_BUFFER: Buffer;
let TEST_GIF_BUFFER: Buffer;
let TEST_ANIMATED_WEBP_BUFFER: Buffer;

beforeAll(async () => {
  // Generate valid test images using Sharp
  TEST_JPEG_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  TEST_GIF_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } }
  }).gif().toBuffer();

  // Multi-frame, non-GIF source (animated WebP). Used to verify that animation is
  // preserved through a format conversion for any multi-page source, not just GIF.
  const frames = await Promise.all(
    [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 }
    ].map(background =>
      sharp({ create: { width: 30, height: 30, channels: 4, background: { ...background, alpha: 1 } } })
        .png()
        .toBuffer()
    )
  );
  TEST_ANIMATED_WEBP_BUFFER = await sharp(frames, { join: { animated: true } }).webp().toBuffer();
});

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = ImageProcessorService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ImageProcessorService.getInstance();
      const instance2 = ImageProcessorService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('process', () => {
    it('should throw error for missing origin URL', async () => {
      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: '' },
        transformations: [],
        response: { headers: {} }
      };

      await expect(service.process(request)).rejects.toThrow();
    });

    it('should handle empty transformations array', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: mockBuffer,
        metadata: { size: mockBuffer.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(mockBuffer);
    });
  });

  describe('overlay size calculation', () => {
    it('should calculate percentage-based overlay size', () => {
      const result = EditApplicator.calcOverlaySizeOption('50p', 1000, 100);
      expect(result).toBe(500);
    });

    it('should calculate absolute overlay size', () => {
      const result = EditApplicator.calcOverlaySizeOption('200', 1000, 100);
      expect(result).toBe(200);
    });

    it('should handle negative values', () => {
      const result = EditApplicator.calcOverlaySizeOption('-50', 1000, 100);
      expect(result).toBe(850); // 1000 + (-50) - 100
    });

    it('should handle numeric input', () => {
      const result = EditApplicator.calcOverlaySizeOption(150, 1000, 100);
      expect(result).toBe(150);
    });

    it('should handle negative percentage values', () => {
      const result = EditApplicator.calcOverlaySizeOption('-25p', 1000, 100);
      expect(result).toBe(650); // floor(1000 + (1000 * -25) / 100) - 100 = 750 - 100
    });
  });

  describe('process request initialization', () => {
    it('should initialize timings object if missing', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: mockBuffer,
        metadata: { size: mockBuffer.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      await service.process(request);
      expect(request.timings).toBeDefined();
      expect(request.timings.imageProcessing).toBeDefined();
    });

    it('should set sourceImageContentType on response for no-transform case', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: mockBuffer,
        metadata: { size: mockBuffer.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        sourceImageContentType: 'image/jpeg',
        response: { headers: {} }
      };

      await service.process(request);
      expect(request.response.contentType).toBe('image/jpeg');
    });
  });

  describe('full transformation pipeline', () => {
    it('should process image with transformations and set contentType from output', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length, format: 'jpeg' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-pipeline',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 1 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toMatch(/^image\//);
      expect(request.timings.imageProcessing.transformationApplicationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preventAutoUpscaling', () => {
    it('should filter out auto-resize transforms that would upscale', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-upscale',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [
          { type: 'resize', value: { width: 5000 }, source: 'auto' }, // Should be filtered (upscale)
          { type: 'negate', value: true, source: 'url' } // Should remain
        ],
        response: { headers: {} }
      };

      await service.process(request);
      
      expect(request.transformations).toHaveLength(1);
      expect(request.transformations[0].type).toBe('negate');
    });

    it('should keep auto-resize transforms that do not upscale', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-no-upscale',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [
          { type: 'resize', value: { width: 1 }, source: 'auto' } // 1x1 image, width=1 is not upscaling
        ],
        response: { headers: {} }
      };

      await service.process(request);
      
      expect(request.transformations).toHaveLength(1);
    });

    it('should not filter non-auto resize transforms', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-url-resize',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [
          { type: 'resize', value: { width: 5000 }, source: 'url' } // URL source, should not be filtered
        ],
        response: { headers: {} }
      };

      await service.process(request);
      
      expect(request.transformations).toHaveLength(1);
    });
  });

  describe('instantiateSharpImage', () => {
    it('should apply stripExif when specified', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-strip-exif',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'stripExif', value: true, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should apply stripIcc when specified', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-strip-icc',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'stripIcc', value: true, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('error handling', () => {
    it('should wrap errors via ErrorMapper', async () => {
      const originalError = new Error('Fetch failed');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockRejectedValue(originalError);
      jest.spyOn(ErrorMapper, 'mapError');

      const request: ImageProcessingRequest = {
        requestId: 'test-error',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      await expect(service.process(request)).rejects.toThrow();
      expect(ErrorMapper.mapError).toHaveBeenCalledWith(originalError);
    });

    it('should pass through ImageProcessingError unchanged', async () => {
      const processingError = new ImageProcessingError(404, 'NotFound', 'Image not found');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockRejectedValue(processingError);

      const request: ImageProcessingRequest = {
        requestId: 'test-processing-error',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      await expect(service.process(request)).rejects.toThrow(processingError);
    });
  });

  describe('transformation metrics', () => {
    it('should populate metrics after transformation', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_JPEG_BUFFER,
        metadata: { size: TEST_JPEG_BUFFER.length, format: 'jpeg' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-metrics',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      await service.process(request);

      expect(request.metrics).toBeDefined();
      expect(request.metrics.postOptimization.width).toBeGreaterThan(0);
      expect(request.metrics.compressionRatio).toBeGreaterThan(0);
    });

  });

  describe('SVG handling', () => {
    const TEST_SVG_BUFFER = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>'
    );

    it('should passthrough SVG unmodified when no transformations', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-passthrough',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/logo.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(TEST_SVG_BUFFER);
      expect(request.response.contentType).toBe('image/svg+xml');
    });

    it('should set attachment + restrictive CSP headers on SVG passthrough with no transformations', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-headers-no-transform',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/logo.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [],
        response: { headers: {} }
      };

      await service.process(request);
      expect(request.response.headers['Content-Disposition']).toBe('attachment');
      expect(request.response.headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
    });

    it('should set attachment + restrictive CSP headers on SVG passthrough with only a quality transform', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-headers-quality',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/logo.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'quality', value: 80, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      // No format/rasterizing transform -> passthrough, so raw SVG bytes are returned.
      expect(result).toBe(TEST_SVG_BUFFER);
      expect(request.response.contentType).toBe('image/svg+xml');
      expect(request.response.headers['Content-Disposition']).toBe('attachment');
      expect(request.response.headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
    });

    it('should NOT set SVG safety headers when a resize rasterizes the SVG to PNG', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-rasterized-no-headers',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/png');
      expect(request.response.headers['Content-Disposition']).toBeUndefined();
      expect(request.response.headers['Content-Security-Policy']).toBeUndefined();
    });

    it('should default SVG output to PNG when transformations exist but no explicit format', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-to-png',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/png');
    });

    it('should respect explicit format conversion for SVG input', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-to-webp',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [
          { type: 'resize', value: { width: 50 }, source: 'url' },
          { type: 'format', value: 'webp', source: 'url' }
        ],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/webp');
    });

    it('should not inject PNG when auto-optimization has already set a format', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_SVG_BUFFER,
        metadata: { size: TEST_SVG_BUFFER.length, format: 'svg+xml' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-auto-format',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [
          { type: 'resize', value: { width: 50 }, source: 'url' },
          { type: 'format', value: 'avif', source: 'auto' }
        ],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).not.toBe('image/png');
      expect(request.transformations.filter(t => t.type === 'format')).toHaveLength(1);
    });
  });

  describe('animated image handling', () => {
    it('should process a single-frame GIF as a static (non-animated) image', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_GIF_BUFFER,
        metadata: { size: TEST_GIF_BUFFER.length, format: 'gif' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-single-frame-gif',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.gif' },
        sourceImageContentType: 'image/gif',
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);

      // A single-frame source must collapse to a static output regardless of format.
      const outputMetadata = await sharp(result).metadata();
      expect(outputMetadata.pages ?? 1).toBe(1);
    });

    it('should preserve animation for a multi-frame non-GIF source through format conversion', async () => {
      // Animation is derived from the decoded frame count, not the source content type.
      // A multi-frame WebP converted to GIF must keep all of its frames; if Sharp were
      // instantiated with animated=false (the previous GIF-only behavior) the output
      // would collapse to a single frame.
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_ANIMATED_WEBP_BUFFER,
        metadata: { size: TEST_ANIMATED_WEBP_BUFFER.length, format: 'webp' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-animated-webp-to-gif',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.webp' },
        sourceImageContentType: 'image/webp',
        transformations: [{ type: 'format', value: 'gif', source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);

      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/gif');

      // The converted GIF must retain every frame from the source animation.
      const outputMetadata = await sharp(result).metadata();
      expect(outputMetadata.format).toBe('gif');
      expect(outputMetadata.pages).toBe(3);
    });

    it('should preserve animation for a multi-frame source when no format conversion occurs', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_ANIMATED_WEBP_BUFFER,
        metadata: { size: TEST_ANIMATED_WEBP_BUFFER.length, format: 'webp' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-animated-webp-resize',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.webp' },
        sourceImageContentType: 'image/webp',
        transformations: [{ type: 'resize', value: { width: 15 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);

      expect(result).toBeInstanceOf(Buffer);

      const outputMetadata = await sharp(result).metadata();
      expect(outputMetadata.format).toBe('webp');
      expect(outputMetadata.pages).toBe(3);
    });
  });

});