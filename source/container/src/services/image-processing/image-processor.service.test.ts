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
let TEST_STILL_WEBP_BUFFER: Buffer;     
let TEST_APNG_BUFFER: Buffer;


beforeAll(async () => {
  // Generate valid test images using Sharp
  TEST_JPEG_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();
  
  TEST_GIF_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } }
  }).gif().toBuffer();
  
  TEST_ANIMATED_WEBP_BUFFER = await sharp([
    { create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } } as any,
    { create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } } as any,
    { create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } } as any,
  ], { join: { animated: true } } as any)
    .webp({ loop: 0, delay: [100, 100, 100] })
    .toBuffer();



  // Issue #7: still WebP for the "single-frame falls back to animated:false" guard
  TEST_STILL_WEBP_BUFFER = await sharp({
    create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } }
  }).webp().toBuffer();

  
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const buildChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  TEST_APNG_BUFFER = Buffer.concat([
    PNG_SIG,
    buildChunk('IHDR', Buffer.alloc(13)),
    buildChunk('acTL', Buffer.alloc(8)),
    buildChunk('IDAT', Buffer.alloc(16)),
  ]);
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

    it('should pass ICO through unchanged regardless of transformations', async () => {
      const icoBuffer = Buffer.from('00000100', 'hex'); // ICO magic bytes
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: icoBuffer,
        metadata: { size: icoBuffer.length, format: 'x-icon' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-ico-1',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/favicon.ico' },
        sourceImageContentType: 'image/x-icon',
        transformations: [{ type: 'format', value: 'webp', source: 'auto' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(icoBuffer);
      expect(request.response.contentType).toBe('image/x-icon');
    });

    it('should pass image/vnd.microsoft.icon through unchanged', async () => {
      const icoBuffer = Buffer.from('00000100', 'hex');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: icoBuffer,
        metadata: { size: icoBuffer.length }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-ico-2',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/favicon.ico' },
        sourceImageContentType: 'image/vnd.microsoft.icon',
        transformations: [{ type: 'resize', value: { width: 100 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(icoBuffer);
      expect(request.response.contentType).toBe('image/vnd.microsoft.icon');
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

  describe('animated GIF handling', () => {
    it('should re-instantiate with animated=false for single-frame GIF', async () => {
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
    });
  });
  describe('animated WebP handling (Issue #7)', () => {
    it('should preserve animation when source is animated WebP and output is webp', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_ANIMATED_WEBP_BUFFER,
        metadata: { size: TEST_ANIMATED_WEBP_BUFFER.length, format: 'webp' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-animated-webp',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/anim.webp' },
        sourceImageContentType: 'image/webp',
        transformations: [{ type: 'resize', value: { width: 25 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);

      // Verify output is still multi-page (animation preserved)
      const outMeta = await sharp(result, { animated: true }).metadata();
      expect(outMeta.pages).toBeGreaterThan(1);
      expect(request.response.contentType).toBe('image/webp');
    });

    it('should re-instantiate with animated=false for single-frame WebP', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_STILL_WEBP_BUFFER,
        metadata: { size: TEST_STILL_WEBP_BUFFER.length, format: 'webp' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-still-webp',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/still.webp' },
        sourceImageContentType: 'image/webp',
        transformations: [{ type: 'resize', value: { width: 25 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBeInstanceOf(Buffer);

      // Output should be a valid still WebP (pages undefined or 1)
      const outMeta = await sharp(result).metadata();
      expect(outMeta.pages === undefined || outMeta.pages <= 1).toBe(true);
    });
  });
    describe('animated PNG (APNG) handling (Issue #8)', () => {
    it('should pass APNG through unchanged when source is image/png and buffer is APNG', async () => {
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: TEST_APNG_BUFFER,
        metadata: { size: TEST_APNG_BUFFER.length, format: 'png' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-apng',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/anim.png' },
        sourceImageContentType: 'image/png',
        transformations: [{ type: 'format', value: 'webp', source: 'auto' }],
        response: { headers: {} }
      };

      const result = await service.process(request);

      // Buffer returned untouched, content-type stays image/png
      expect(result).toBe(TEST_APNG_BUFFER);
      expect(request.response.contentType).toBe('image/png');
    });

    it('should still process a still PNG normally (no APNG short-circuit)', async () => {
      const stillPng = await sharp({
        create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).png().toBuffer();

      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: stillPng,
        metadata: { size: stillPng.length, format: 'png' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-still-png',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/still.png' },
        sourceImageContentType: 'image/png',
        transformations: [{ type: 'resize', value: { width: 10 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);

      // Still PNG goes through Sharp (different buffer, resized)
      expect(result).not.toBe(stillPng);
      const meta = await sharp(result).metadata();
      expect(meta.width).toBe(10);
    });
  });
  describe('SVG passthrough (Issue #11)', () => {
    it('should pass SVG through unchanged with format conversion transformation', async () => {
      const svgBuffer = Buffer.from(
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'
      );
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: svgBuffer,
        metadata: { size: svgBuffer.length, format: 'svg' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-1',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/icon.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'format', value: 'webp', source: 'auto' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(svgBuffer);
      expect(request.response.contentType).toBe('image/svg+xml');
    });

    it('should pass SVG through unchanged with resize transformation (URL params ignored)', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>');
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: svgBuffer,
        metadata: { size: svgBuffer.length, format: 'svg' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-2',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/badge.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'resize', value: { width: 100 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(svgBuffer);
      expect(request.response.contentType).toBe('image/svg+xml');
    });
  });
  describe('BMP passthrough (Issue #13)', () => {
    it('should pass image/bmp through unchanged with resize transformation (URL params ignored)', async () => {
      const bmpBuffer = Buffer.from([0x42, 0x4D, 0x00, 0x00]); // BMP magic 'BM' + filler
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: bmpBuffer,
        metadata: { size: bmpBuffer.length, format: 'bmp' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-bmp-1',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/card.bmp' },
        sourceImageContentType: 'image/bmp',
        transformations: [{ type: 'resize', value: { width: 282 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(bmpBuffer);
      expect(request.response.contentType).toBe('image/bmp');
    });

    it('should pass image/x-ms-bmp through unchanged with format transformation', async () => {
      const bmpBuffer = Buffer.from([0x42, 0x4D, 0x00, 0x00]);
      jest.spyOn(service['originFetcher'], 'fetchImage').mockResolvedValue({
        buffer: bmpBuffer,
        metadata: { size: bmpBuffer.length, format: 'bmp' }
      });

      const request: ImageProcessingRequest = {
        requestId: 'test-bmp-2',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/card.bmp' },
        sourceImageContentType: 'image/x-ms-bmp',
        transformations: [{ type: 'format', value: 'webp', source: 'auto' }],
        response: { headers: {} }
      };

      const result = await service.process(request);
      expect(result).toBe(bmpBuffer);
      expect(request.response.contentType).toBe('image/x-ms-bmp');
    });
  });



});