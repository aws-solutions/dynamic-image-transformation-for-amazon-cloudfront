// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EditApplicator } from './edit-applicator';
import { ImageEdits } from '../interfaces';
import { ImageFitTypes } from '../enums';
import { ImageProcessingError } from '../types';
import { SharpUtils } from '../utils/sharp-utils';
import { SmartCropService } from '../../smart-crop/smart-crop.service';
import { ContentModerationService } from '../../content-moderation/content-moderation.service';
import { CacheRegistry } from '../../cache/cache-registry';
import { ORIGIN_BODY_LIMIT_BYTES } from '../../../utils/origin-body-limit';
import sharp from 'sharp';

jest.mock('../utils/sharp-utils');
jest.mock('../../smart-crop/smart-crop.service');
jest.mock('../../content-moderation/content-moderation.service');

const createMockSharp = (metadata = { width: 800, height: 600, format: 'jpeg', pages: 1 }) => {
  const mock: any = {
    metadata: jest.fn().mockResolvedValue(metadata),
    resize: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    flop: jest.fn().mockReturnThis(),
    grayscale: jest.fn().mockReturnThis(),
    extract: jest.fn().mockReturnThis(),
  };
  return mock;
};

const mockOriginFetcher = { fetchImage: jest.fn() };
const mockExecute = jest.fn().mockResolvedValue({ fallbackApplied: false });
const mockContentModerationExecute = jest.fn().mockResolvedValue(undefined);

describe('EditApplicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SharpUtils.shouldSkipForAnimation as jest.Mock).mockReturnValue(false);
    (SharpUtils.isAllowedTransformation as jest.Mock).mockReturnValue(true);
    (SmartCropService.getInstance as jest.Mock).mockReturnValue({ execute: mockExecute });
    (ContentModerationService.getInstance as jest.Mock).mockReturnValue({ execute: mockContentModerationExecute });
  });

  describe('applyEdits', () => {
    it('Should apply basic edits via default case', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { flip: true };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.flip).toHaveBeenCalledWith(true);
    });

    it('Should handle rotate with numeric value', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { rotate: 90 };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.rotate).toHaveBeenCalledWith(90);
    });

    it('Should handle rotate with null string value', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { rotate: 'null' };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.rotate).toHaveBeenCalledWith(null);
    });

    it('Should skip operations for animations when appropriate', async () => {
      const mockImage = createMockSharp({ width: 800, height: 600, format: 'gif', pages: 5 });
      (SharpUtils.shouldSkipForAnimation as jest.Mock).mockReturnValue(true);
      const edits: ImageEdits = { flip: true };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.flip).not.toHaveBeenCalled();
    });

    it('Should defer resize when extract present', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { resize: { width: 100 }, extract: { left: 0, top: 0, width: 50, height: 50 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      // Resize should be called once at the end (deferred)
      expect(mockImage.resize).toHaveBeenCalledTimes(1);
      expect(mockImage.resize).toHaveBeenCalledWith(edits.resize);
    });

    it('Should wrap non-ImageProcessingError in ImageProcessingError', async () => {
      const mockImage = createMockSharp();
      mockImage.metadata.mockRejectedValue(new Error('Sharp failed'));

      await expect(EditApplicator.applyEdits(mockImage, {}, mockOriginFetcher as any))
        .rejects.toThrow(ImageProcessingError);
    });

    it('Should rethrow ImageProcessingError as-is', async () => {
      const mockImage = createMockSharp();
      const originalError = new ImageProcessingError(400, 'TestError', 'Test message');
      mockImage.metadata.mockRejectedValue(originalError);

      await expect(EditApplicator.applyEdits(mockImage, {}, mockOriginFetcher as any))
        .rejects.toBe(originalError);
    });
  });

  describe('applyResize (via applyEdits)', () => {
    it('Should set default fit=INSIDE when resize undefined', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = {};

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(edits.resize).toEqual({ fit: ImageFitTypes.INSIDE });
    });

    it('Should apply resize with explicit width/height', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { resize: { width: 200, height: 150 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.resize).toHaveBeenCalledWith({ width: 200, height: 150 });
    });

    it('Should calculate dimensions from ratio using provided width/height', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { resize: { width: 100, height: 100, ratio: 0.5 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(edits.resize.width).toBe(50);
      expect(edits.resize.height).toBe(50);
      expect(edits.resize.ratio).toBeUndefined();
    });

    it('Should calculate dimensions from ratio using image metadata', async () => {
      const mockImage = createMockSharp({ width: 800, height: 600, format: 'jpeg', pages: 1 });
      const edits: ImageEdits = { resize: { ratio: 0.5 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(edits.resize.width).toBe(400);
      expect(edits.resize.height).toBe(300);
      expect(edits.resize.fit).toBe(ImageFitTypes.INSIDE);
    });
  });

  describe('applySharpen (via applyEdits)', () => {
    it('Should call sharpen with undefined when value is true', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { sharpen: true };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.sharpen).toHaveBeenCalledWith(undefined);
    });

    it('Should call sharpen with explicit params when object provided', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { sharpen: { sigma: 2, m1: 0.5 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.sharpen).toHaveBeenCalledWith({ sigma: 2, m1: 0.5 });
    });
  });

  describe('applyFormat (via applyEdits)', () => {
    it('Should use toFormat from edits when provided', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { toFormat: 'png' };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.toFormat).toHaveBeenCalledWith('png', {});
    });

    it('Should fallback to metadata format when toFormat not provided', async () => {
      const mockImage = createMockSharp({ width: 800, height: 600, format: 'webp', pages: 1 });
      const edits: ImageEdits = {};

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.toFormat).toHaveBeenCalledWith('webp', {});
    });

    it('Should apply quality option when provided', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { toFormat: 'jpeg', quality: 80 };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.toFormat).toHaveBeenCalledWith('jpeg', { quality: 80 });
    });

    it('Should add compression=av1 for heif format', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { toFormat: 'heif' };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockImage.toFormat).toHaveBeenCalledWith('heif', { compression: 'av1' });
    });
  });

  describe('calcOverlaySizeOption', () => {
    it('Should calculate percentage-based position (positive)', () => {
      const result = EditApplicator.calcOverlaySizeOption('50p', 1000, 100);
      expect(result).toBe(500);
    });

    it('Should calculate percentage-based position (negative)', () => {
      const result = EditApplicator.calcOverlaySizeOption('-10p', 1000, 100);
      expect(result).toBe(800); // floor(1000 + (1000 * -10) / 100) - 100 = 900 - 100
    });

    it('Should calculate absolute position (positive)', () => {
      const result = EditApplicator.calcOverlaySizeOption(200, 1000, 100);
      expect(result).toBe(200);
    });

    it('Should calculate absolute position (negative)', () => {
      const result = EditApplicator.calcOverlaySizeOption(-50, 1000, 100);
      expect(result).toBe(850); // 1000 + (-50) - 100
    });
  });

  describe('smartCrop delegation', () => {
    it('Should delegate to SmartCropService.execute with params', async () => {
      const mockImage = createMockSharp();
      const smartCropParams = { faces: true, padding: 10 };
      const edits: ImageEdits = { smartCrop: smartCropParams };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockExecute).toHaveBeenCalledWith(mockImage, smartCropParams);
    });

    it('Should not call SmartCropService when smartCrop is not in edits', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { resize: { width: 100 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('Should combine smart crop with other transformations', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { smartCrop: { faces: true }, toFormat: 'webp' };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockExecute).toHaveBeenCalled();
      expect(mockImage.toFormat).toHaveBeenCalledWith('webp', {});
    });
  });

  describe('normalizeSource', () => {
    const normalizeSource = (EditApplicator as any).normalizeSource.bind(EditApplicator);

    it('Should strip http:// and add https://', () => {
      const result = normalizeSource('http://example.com/image.jpg');
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('Should strip https:// and add https://', () => {
      const result = normalizeSource('https://example.com/image.jpg');
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('Should handle source without protocol', () => {
      const result = normalizeSource('example.com/image.jpg');
      expect(result).toBe('https://example.com/image.jpg');
    });
  });

  describe('contentModeration delegation', () => {
    it('Should delegate to ContentModerationService.execute with params', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { contentModeration: true };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockContentModerationExecute).toHaveBeenCalledWith(mockImage, true);
    });

    it('Should delegate with config object', async () => {
      const mockImage = createMockSharp();
      const config = { minConfidence: 60, blur: 100, moderationLabels: ['Smoking'] };
      const edits: ImageEdits = { contentModeration: config };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockContentModerationExecute).toHaveBeenCalledWith(mockImage, config);
    });

    it('Should not call ContentModerationService when contentModeration is not in edits', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { resize: { width: 100 } };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockContentModerationExecute).not.toHaveBeenCalled();
    });

    it('Should skip contentModeration for animated images', async () => {
      const mockImage = createMockSharp({ width: 800, height: 600, format: 'gif', pages: 5 });
      const edits: ImageEdits = { contentModeration: true };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockContentModerationExecute).not.toHaveBeenCalled();
    });

    it('Should combine contentModeration with other transformations', async () => {
      const mockImage = createMockSharp();
      const edits: ImageEdits = { contentModeration: true, toFormat: 'webp' };

      await EditApplicator.applyEdits(mockImage, edits, mockOriginFetcher as any);

      expect(mockContentModerationExecute).toHaveBeenCalled();
      expect(mockImage.toFormat).toHaveBeenCalledWith('webp', {});
    });
  });
  describe('watermark overlay shares the origin body budget with the primary image', () => {
    const OVERLAY_URL = 'https://overlay.example.com/logo.png';
    const watermark = (): ImageEdits => ({ composite: { source: 'overlay.example.com/logo.png', offSetArray: [0, 0, 0, undefined, undefined] } } as any);
    let overlayPng: Buffer;

    beforeAll(async () => {
      overlayPng = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    });

    beforeEach(() => {
      jest.spyOn(CacheRegistry, 'getInstance').mockReturnValue({
        getOriginCache: () => ({ getContents: jest.fn().mockResolvedValue([{ originDomain: 'overlay.example.com' }]) }),
      } as any);
    });

    const imageWithComposite = () => {
      const image = createMockSharp();
      image.composite = jest.fn().mockReturnThis();
      return image;
    };

    it('fetches the overlay with the limit left after the primary and applies the composite', async () => {
      mockOriginFetcher.fetchImage.mockResolvedValue({ buffer: overlayPng, metadata: { size: overlayPng.length, format: 'png' } });
      const image = imageWithComposite();

      await EditApplicator.applyEdits(image, watermark(), mockOriginFetcher as any, 1000);

      expect(mockOriginFetcher.fetchImage).toHaveBeenCalledWith(OVERLAY_URL, undefined, undefined, ORIGIN_BODY_LIMIT_BYTES - 1000);
      expect(image.composite).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['exactly at', ORIGIN_BODY_LIMIT_BYTES],
      ['over', ORIGIN_BODY_LIMIT_BYTES + 1],
    ])('gives the overlay a zero budget when the primary is %s the limit', async (_label, primaryBytes) => {
      mockOriginFetcher.fetchImage.mockRejectedValue(new ImageProcessingError(502, 'OriginImageTooLarge', 'Origin image exceeds the maximum size'));
      const image = imageWithComposite();

      await expect(EditApplicator.applyEdits(image, watermark(), mockOriginFetcher as any, primaryBytes))
        .rejects.toMatchObject({ statusCode: 502, errorType: 'OverlayFetchError' });
      expect(mockOriginFetcher.fetchImage).toHaveBeenCalledWith(OVERLAY_URL, undefined, undefined, 0);
      expect(image.composite).not.toHaveBeenCalled();
    });

    it('rejects with OverlayFetchError (502) when the overlay does not fit in the remaining budget', async () => {
      const verbose = "Origin 'https://overlay.example.com/w.png' body of 2000 bytes exceeds the 1000 byte limit.";
      mockOriginFetcher.fetchImage.mockRejectedValue(new ImageProcessingError(502, 'OriginImageTooLarge', 'Origin image exceeds the maximum size', verbose));
      const image = imageWithComposite();

      await expect(EditApplicator.applyEdits(image, watermark(), mockOriginFetcher as any, 1000))
        .rejects.toMatchObject({ statusCode: 502, errorType: 'OverlayFetchError', verboseDescription: verbose });
      expect(image.composite).not.toHaveBeenCalled();
    });

    it('passes the full limit when no primary size is given', async () => {
      mockOriginFetcher.fetchImage.mockResolvedValue({ buffer: overlayPng, metadata: { size: overlayPng.length, format: 'png' } });

      await EditApplicator.applyEdits(imageWithComposite(), watermark(), mockOriginFetcher as any);

      expect(mockOriginFetcher.fetchImage).toHaveBeenCalledWith(OVERLAY_URL, undefined, undefined, ORIGIN_BODY_LIMIT_BYTES);
    });
  });
});
