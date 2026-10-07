// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageProcessorService } from './image-processor.service';
import { ImageProcessingRequest } from '../../types/image-processing-request';
import { EditApplicator } from './transformation-engine/edit-applicator';
import { ErrorMapper } from './utils/error-mapping';
import { ImageProcessingError } from './types';
import { TransformationMapper } from './transformation-engine/transformation-mapper';
import sharp from 'sharp';

// process() no longer fetches: the request resolver attaches the source image before it runs.
let stubbedSource: { buffer: Buffer; format?: string } | undefined;
function stubSource(buffer: Buffer, format?: string): void {
  stubbedSource = { buffer, format };
}
function processWithSource(request: ImageProcessingRequest): Promise<Buffer> {
  if (stubbedSource && !request.sourceImage) {
    request.sourceImage = {
      buffer: stubbedSource.buffer,
      contentType: `image/${stubbedSource.format ?? 'jpeg'}`,
      format: stubbedSource.format,
      fetchDurationMs: 7,
    };
  }
  return ImageProcessorService.getInstance().process(request);
}

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
    stubbedSource = undefined;
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
    it('should throw when no source image was attached', async () => {
      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      await expect(processWithSource(request)).rejects.toMatchObject({ statusCode: 500, errorType: 'MissingSourceImage' });
    });

    it('should not make any origin request', async () => {
      const fetchSpy = jest.spyOn(service['originFetcher'], 'fetchImage');
      stubSource(TEST_JPEG_BUFFER, 'jpeg');

      await processWithSource({
        requestId: 'test-no-fetch',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should report the attached fetch duration as originFetchMs and exclude it from transformationApplicationMs', async () => {
      stubSource(TEST_JPEG_BUFFER, 'jpeg');
      const request: ImageProcessingRequest = {
        requestId: 'test-timings',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} },
        sourceImage: { buffer: TEST_JPEG_BUFFER, contentType: 'image/jpeg', format: 'jpeg', fetchDurationMs: 60000 }
      };

      await processWithSource(request);

      expect(request.timings?.imageProcessing?.originFetchMs).toBe(60000);
      expect(request.metrics?.timings.originFetchMs).toBe(60000);
      expect(request.timings?.imageProcessing?.transformationApplicationMs).toBeGreaterThanOrEqual(0);
      expect(request.timings?.imageProcessing?.transformationApplicationMs).toBeLessThan(60000);
    });

    it('should handle empty transformations array', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      stubSource(mockBuffer);

      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
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
      stubSource(mockBuffer);

      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        response: { headers: {} }
      };

      await processWithSource(request);
      expect(request.timings).toBeDefined();
      expect(request.timings.imageProcessing).toBeDefined();
    });

    it('should set sourceImageContentType on response for no-transform case', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      stubSource(mockBuffer);

      const request: ImageProcessingRequest = {
        requestId: 'test-123',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [],
        sourceImageContentType: 'image/jpeg',
        response: { headers: {} }
      };

      await processWithSource(request);
      expect(request.response.contentType).toBe('image/jpeg');
    });
  });

  describe('full transformation pipeline', () => {
    it('should process image with transformations and set contentType from output', async () => {
      stubSource(TEST_JPEG_BUFFER, 'jpeg');

      const request: ImageProcessingRequest = {
        requestId: 'test-pipeline',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 1 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toMatch(/^image\//);
      expect(request.timings.imageProcessing.transformationApplicationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preventAutoUpscaling', () => {
    it('should filter out auto-resize transforms that would upscale', async () => {
      stubSource(TEST_JPEG_BUFFER);

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

      await processWithSource(request);
      
      expect(request.transformations).toHaveLength(1);
      expect(request.transformations[0].type).toBe('negate');
    });

    it('should keep auto-resize transforms that do not upscale', async () => {
      stubSource(TEST_JPEG_BUFFER);

      const request: ImageProcessingRequest = {
        requestId: 'test-no-upscale',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [
          { type: 'resize', value: { width: 1 }, source: 'auto' } // 1x1 image, width=1 is not upscaling
        ],
        response: { headers: {} }
      };

      await processWithSource(request);
      
      expect(request.transformations).toHaveLength(1);
    });

    it('should not filter non-auto resize transforms', async () => {
      stubSource(TEST_JPEG_BUFFER);

      const request: ImageProcessingRequest = {
        requestId: 'test-url-resize',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [
          { type: 'resize', value: { width: 5000 }, source: 'url' } // URL source, should not be filtered
        ],
        response: { headers: {} }
      };

      await processWithSource(request);
      
      expect(request.transformations).toHaveLength(1);
    });
  });

  describe('instantiateSharpImage', () => {
    it('should apply stripExif when specified', async () => {
      stubSource(TEST_JPEG_BUFFER);

      const request: ImageProcessingRequest = {
        requestId: 'test-strip-exif',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'stripExif', value: true, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should apply stripIcc when specified', async () => {
      stubSource(TEST_JPEG_BUFFER);

      const request: ImageProcessingRequest = {
        requestId: 'test-strip-icc',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'stripIcc', value: true, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('error handling', () => {
    it('should wrap errors via ErrorMapper', async () => {
      stubSource(Buffer.from('not-an-image'));
      jest.spyOn(ErrorMapper, 'mapError');

      const request: ImageProcessingRequest = {
        requestId: 'test-error',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      await expect(processWithSource(request)).rejects.toThrow();
      expect(ErrorMapper.mapError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass through ImageProcessingError unchanged', async () => {
      const processingError = new ImageProcessingError(422, 'Unprocessable', 'Cannot apply edits');
      stubSource(TEST_JPEG_BUFFER, 'jpeg');
      jest.spyOn(TransformationMapper, 'mapToImageEdits').mockRejectedValueOnce(processingError);

      const request: ImageProcessingRequest = {
        requestId: 'test-processing-error',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      await expect(processWithSource(request)).rejects.toThrow(processingError);
    });
  });

  describe('transformation metrics', () => {
    it('should populate metrics after transformation', async () => {
      stubSource(TEST_JPEG_BUFFER, 'jpeg');

      const request: ImageProcessingRequest = {
        requestId: 'test-metrics',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.jpg' },
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      await processWithSource(request);

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
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-passthrough',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/logo.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      expect(result).toBe(TEST_SVG_BUFFER);
      expect(request.response.contentType).toBe('image/svg+xml');
    });

    it('should set attachment + restrictive CSP headers on SVG passthrough with no transformations', async () => {
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-headers-no-transform',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/logo.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [],
        response: { headers: {} }
      };

      await processWithSource(request);
      expect(request.response.headers['Content-Disposition']).toBe('attachment');
      expect(request.response.headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
    });

    it('should set attachment + restrictive CSP headers on SVG passthrough with only a quality transform', async () => {
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-headers-quality',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/logo.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'quality', value: 80, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      // No format/rasterizing transform -> passthrough, so raw SVG bytes are returned.
      expect(result).toBe(TEST_SVG_BUFFER);
      expect(request.response.contentType).toBe('image/svg+xml');
      expect(request.response.headers['Content-Disposition']).toBe('attachment');
      expect(request.response.headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
    });

    it('should NOT set SVG safety headers when a resize rasterizes the SVG to PNG', async () => {
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-rasterized-no-headers',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/png');
      expect(request.response.headers['Content-Disposition']).toBeUndefined();
      expect(request.response.headers['Content-Security-Policy']).toBeUndefined();
    });

    it('should default SVG output to PNG when transformations exist but no explicit format', async () => {
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

      const request: ImageProcessingRequest = {
        requestId: 'test-svg-to-png',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.svg' },
        sourceImageContentType: 'image/svg+xml',
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/png');
    });

    it('should respect explicit format conversion for SVG input', async () => {
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

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

      const result = await processWithSource(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/webp');
    });

    it('should not inject PNG when auto-optimization has already set a format', async () => {
      stubSource(TEST_SVG_BUFFER, 'svg+xml');

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

      const result = await processWithSource(request);
      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).not.toBe('image/png');
      expect(request.transformations.filter(t => t.type === 'format')).toHaveLength(1);
    });
  });

  describe('animated image handling', () => {
    it('should process a single-frame GIF as a static (non-animated) image', async () => {
      stubSource(TEST_GIF_BUFFER, 'gif');

      const request: ImageProcessingRequest = {
        requestId: 'test-single-frame-gif',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.gif' },
        sourceImageContentType: 'image/gif',
        transformations: [{ type: 'resize', value: { width: 50 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);
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
      stubSource(TEST_ANIMATED_WEBP_BUFFER, 'webp');

      const request: ImageProcessingRequest = {
        requestId: 'test-animated-webp-to-gif',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.webp' },
        sourceImageContentType: 'image/webp',
        transformations: [{ type: 'format', value: 'gif', source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);

      expect(result).toBeInstanceOf(Buffer);
      expect(request.response.contentType).toBe('image/gif');

      // The converted GIF must retain every frame from the source animation.
      const outputMetadata = await sharp(result).metadata();
      expect(outputMetadata.format).toBe('gif');
      expect(outputMetadata.pages).toBe(3);
    });

    it('should preserve animation for a multi-frame source when no format conversion occurs', async () => {
      stubSource(TEST_ANIMATED_WEBP_BUFFER, 'webp');

      const request: ImageProcessingRequest = {
        requestId: 'test-animated-webp-resize',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image.webp' },
        sourceImageContentType: 'image/webp',
        transformations: [{ type: 'resize', value: { width: 15 }, source: 'url' }],
        response: { headers: {} }
      };

      const result = await processWithSource(request);

      expect(result).toBeInstanceOf(Buffer);

      const outputMetadata = await sharp(result).metadata();
      expect(outputMetadata.format).toBe('webp');
      expect(outputMetadata.pages).toBe(3);
    });
  });

  describe('negotiated auto-format capability preservation', () => {
    const TEST_SVG_BUFFER = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
    );
    let alphaPng: Buffer;
    let opaquePng: Buffer;
    let opaqueRgbaPng: Buffer;
    let alphaWebp: Buffer;
    let animatedGif: Buffer;
    let multiPageTiff: Buffer;
    let animatedAlphaWebp: Buffer;

    beforeAll(async () => {
      const transparent = { r: 0, g: 0, b: 255, alpha: 0.4 };
      alphaPng = await sharp({ create: { width: 40, height: 40, channels: 4, background: transparent } }).png().toBuffer();
      alphaWebp = await sharp({ create: { width: 40, height: 40, channels: 4, background: transparent } }).webp().toBuffer();
      opaquePng = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 255, b: 0 } } })
        .png()
        .toBuffer();
      opaqueRgbaPng = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
        .png()
        .toBuffer();
      animatedGif = await sharp(TEST_ANIMATED_WEBP_BUFFER, { animated: true }).gif().toBuffer();
      const page = await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 9, g: 9, b: 9 } } })
        .png()
        .toBuffer();
      multiPageTiff = await sharp([page, page], { join: { animated: true } }).tiff().toBuffer();
      // Frames must differ, or the WebP encoder merges them into a single page.
      const alphaFrames = await Promise.all(
        [
          { r: 255, g: 0, b: 0, alpha: 1 },
          { r: 0, g: 255, b: 0, alpha: 0.4 },
          { r: 0, g: 0, b: 255, alpha: 1 }
        ].map(background => sharp({ create: { width: 30, height: 30, channels: 4, background } }).png().toBuffer())
      );
      animatedAlphaWebp = await sharp(alphaFrames, { join: { animated: true } }).webp().toBuffer();
    });

    const run = async (buffer: Buffer, contentType: string, transformations: any[]) => {
      const request: ImageProcessingRequest = {
        requestId: 'test-negotiated',
        timestamp: Date.now(),
        origin: { url: 'https://example.com/image' },
        sourceImageContentType: contentType,
        sourceImage: { buffer, contentType, format: contentType.split('/')[1], fetchDurationMs: 7 },
        transformations,
        response: { headers: {} }
      };
      const result = await service.process(request);
      const outputMetadata = await sharp(result, { animated: true }).metadata();
      return { request, outputMetadata };
    };
    const negotiated = (value: string) => ({ type: 'format', value, source: 'auto' as const, negotiated: true });

    it('keeps the source format when negotiated jpeg would drop alpha', async () => {
      const { request, outputMetadata } = await run(alphaPng, 'image/png', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/png');
      expect(outputMetadata.hasAlpha).toBe(true);
    });

    it('keeps the source format when negotiated gif would reduce alpha to 1-bit', async () => {
      const { request } = await run(alphaPng, 'image/png', [negotiated('gif')]);
      expect(request.response.contentType).toBe('image/png');
    });

    it('keeps an alpha WebP source as webp when negotiated jpeg would drop alpha', async () => {
      const { request, outputMetadata } = await run(alphaWebp, 'image/webp', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/webp');
      expect(outputMetadata.hasAlpha).toBe(true);
    });

    it('applies a negotiated alpha-capable format to an alpha source', async () => {
      const { request, outputMetadata } = await run(alphaPng, 'image/png', [negotiated('webp')]);
      expect(request.response.contentType).toBe('image/webp');
      expect(outputMetadata.hasAlpha).toBe(true);
    });

    it('still converts an opaque source to negotiated jpeg', async () => {
      const { request } = await run(opaquePng, 'image/png', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/jpeg');
    });

    it('converts an RGBA source with no transparent pixels to negotiated jpeg', async () => {
      expect((await sharp(opaqueRgbaPng).metadata()).hasAlpha).toBe(true);
      const { request } = await run(opaqueRgbaPng, 'image/png', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/jpeg');
    });

    it('does not treat a multi-page TIFF as animated', async () => {
      const { request } = await run(multiPageTiff, 'image/tiff', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/jpeg');
    });

    it('rasterizes an SVG to png when negotiated jpeg would drop alpha', async () => {
      const { request, outputMetadata } = await run(TEST_SVG_BUFFER, 'image/svg+xml', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/png');
      expect(outputMetadata.hasAlpha).toBe(true);
    });

    it('honors flatten: alpha is intentionally removed, so negotiated jpeg applies', async () => {
      const { request } = await run(alphaPng, 'image/png', [
        { type: 'flatten', value: 'white', source: 'policy' },
        negotiated('jpeg')
      ]);
      expect(request.response.contentType).toBe('image/jpeg');
    });

    it('does not override an explicit (non-negotiated) format', async () => {
      const { request } = await run(alphaPng, 'image/png', [{ type: 'format', value: 'jpeg', source: 'url' }]);
      expect(request.response.contentType).toBe('image/jpeg');
    });

    it.each(['jpeg', 'png', 'avif'])('keeps animated WebP as webp when negotiated %s would drop frames', async (format) => {
      const { request, outputMetadata } = await run(TEST_ANIMATED_WEBP_BUFFER, 'image/webp', [negotiated(format)]);
      expect(request.response.contentType).toBe('image/webp');
      expect(outputMetadata.pages).toBe(3);
    });

    // For animation, compatibility wins: gif is often the only animated format legacy clients support,
    // so it's allowed even though it reduces alpha to 1-bit. Static alpha sources stay strict.
    it('converts animated WebP with alpha to negotiated gif and keeps frames', async () => {
      const { request, outputMetadata } = await run(animatedAlphaWebp, 'image/webp', [negotiated('gif')]);
      expect(request.response.contentType).toBe('image/gif');
      expect(outputMetadata.pages).toBe(3);
    });

    it('converts opaque animated WebP to negotiated gif and keeps frames', async () => {
      // TEST_ANIMATED_WEBP_BUFFER frames are fully opaque, so the encoder writes no alpha channel.
      const { request, outputMetadata } = await run(TEST_ANIMATED_WEBP_BUFFER, 'image/webp', [negotiated('gif')]);
      expect(request.response.contentType).toBe('image/gif');
      expect(outputMetadata.pages).toBe(3);
    });

    it('keeps animated GIF as gif when negotiated jpeg would drop frames', async () => {
      const { request, outputMetadata } = await run(animatedGif, 'image/gif', [negotiated('jpeg')]);
      expect(request.response.contentType).toBe('image/gif');
      expect(outputMetadata.pages).toBe(3);
    });

    it('converts animated GIF to negotiated webp and keeps frames', async () => {
      const { request, outputMetadata } = await run(animatedGif, 'image/gif', [negotiated('webp')]);
      expect(request.response.contentType).toBe('image/webp');
      expect(outputMetadata.pages).toBe(3);
    });

    it('logs the override with requestId', async () => {
      const logSpy = jest.spyOn(console, 'log');
      await run(alphaPng, 'image/png', [negotiated('jpeg')]);
      const logged = logSpy.mock.calls
        .map(args => args[0])
        .filter(arg => typeof arg === 'string' && arg.includes('auto_format_overridden'))
        .map(arg => JSON.parse(arg));
      expect(logged).toEqual([
        {
          requestId: 'test-negotiated',
          component: 'ImageProcessor',
          operation: 'auto_format_overridden',
          from: 'jpeg',
          to: 'png',
          reason: 'alpha'
        }
      ]);
      logSpy.mockRestore();
    });
  });

});