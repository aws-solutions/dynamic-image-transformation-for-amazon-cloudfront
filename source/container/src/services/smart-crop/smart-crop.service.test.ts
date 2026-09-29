// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SmartCropService } from './smart-crop.service';
import { RekognitionService } from '../rekognition/rekognition.service';
import { DetectionResult, RekognitionApiName } from '../rekognition/types';
import { SmartCropValidationError } from './errors';
import { ParsedSmartCropConfig, SmartCropResult } from './types';

// ─── Mock setup ─────────────────────────────────────────────────────────────────

const mockSharpToBuffer = jest.fn();
const mockSharpInstance: any = {};
const mockResize = jest.fn(() => mockSharpInstance);
const mockJpeg = jest.fn(() => mockSharpInstance);
const mockPng = jest.fn(() => mockSharpInstance);
Object.assign(mockSharpInstance, { resize: mockResize, jpeg: mockJpeg, png: mockPng, toBuffer: mockSharpToBuffer });

jest.mock('sharp', () => {
  const sharpFn = jest.fn(() => mockSharpInstance);
  return { __esModule: true, default: sharpFn };
});

import sharp from 'sharp';
const mockSharp = sharp as unknown as jest.Mock;

const mockDetectTargets = jest.fn();
const mockRekognitionService = { detectTargets: mockDetectTargets } as unknown as RekognitionService;

const createMockSharp = (metadata: { width: number; height: number; format: string } = { width: 800, height: 600, format: 'jpeg' }) => {
  const bufferData = Buffer.from('fake-image');
  const outputInfo = { format: metadata.format, width: metadata.width, height: metadata.height, channels: 3, size: bufferData.length, premultiplied: false };
  const mock: any = {
    metadata: jest.fn().mockResolvedValue(metadata),
    toBuffer: jest.fn().mockResolvedValue({ data: bufferData, info: outputInfo }),
    extract: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnValue({
      toBuffer: jest.fn().mockResolvedValue({ data: bufferData, info: { ...outputInfo, format: 'png' } }),
    }),
  };
  return mock;
};

const makeFaceDetections = (count: number, confidence = 99): DetectionResult => ({
  apiName: 'DetectFaces',
  boundingBoxes: Array.from({ length: count }, (_, i) => ({
    left: 0.2 + i * 0.1,
    top: 0.2,
    width: 0.1,
    height: 0.15,
    label: 'Face',
    confidence,
  })),
});

const makeLabelDetections = (labels: { name: string; confidence: number }[]): DetectionResult => ({
  apiName: 'DetectLabels',
  boundingBoxes: labels.map((l, i) => ({
    left: 0.1 + i * 0.15,
    top: 0.1,
    width: 0.2,
    height: 0.2,
    label: l.name,
    confidence: l.confidence,
  })),
});

describe('SmartCropService', () => {
  let service: SmartCropService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResize.mockReturnValue(mockSharpInstance);
    mockJpeg.mockReturnValue(mockSharpInstance);
    mockPng.mockReturnValue(mockSharpInstance);
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
    service = new SmartCropService(mockRekognitionService);
  });

  // ─── determineRequiredApis ──────────────────────────────────────────────────

  describe('determineRequiredApis', () => {
    it('should include DetectFaces when faces is true', () => {
      const config = { faces: true, labels: [], retainLogo: false, retainText: false } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toContain('DetectFaces');
    });

    it('should include DetectFaces when faceIndex is set', () => {
      const config = { faces: false, faceIndex: 2, labels: [] } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toContain('DetectFaces');
    });

    it('should include DetectLabels when labels are specified', () => {
      const config = { faces: false, labels: ['Cat'], retainLogo: false } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toContain('DetectLabels');
    });

    it('should include DetectLabels when retainLogo is true', () => {
      const config = { faces: false, labels: [], retainLogo: true } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toContain('DetectLabels');
    });

    it('should include DetectText when retainText is true', () => {
      const config = { faces: false, labels: [], retainText: true, retainLogo: false } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toContain('DetectText');
    });

    it('should include DetectCustomLabels when customModelArn is set', () => {
      const config = { faces: false, labels: [], customModelArn: 'arn:aws:rekognition:us-east-1:123:project/my-model/version/1', retainLogo: false, retainText: false } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toContain('DetectCustomLabels');
    });

    it('should return multiple APIs when multiple flags are set', () => {
      const config = { faces: true, labels: ['Dog'], retainText: true, retainLogo: false } as ParsedSmartCropConfig;
      const apis = service.determineRequiredApis(config);
      expect(apis).toContain('DetectFaces');
      expect(apis).toContain('DetectLabels');
      expect(apis).toContain('DetectText');
    });

    it('should not duplicate DetectLabels', () => {
      const config = { faces: false, labels: ['Cat'], retainLogo: true, retainText: false } as ParsedSmartCropConfig;
      const apis = service.determineRequiredApis(config);
      expect(apis.filter((a) => a === 'DetectLabels')).toHaveLength(1);
    });

    it('should return empty when no detection methods enabled', () => {
      const config = { faces: false, labels: [], retainText: false, retainLogo: false } as ParsedSmartCropConfig;
      expect(service.determineRequiredApis(config)).toHaveLength(0);
    });
  });

  // ─── execute: full orchestration flow ───────────────────────────────────────

  describe('execute', () => {
    it('should complete full flow with face detection', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(1)]]));

      const result = await service.execute(mockImage, { faces: true });

      expect(mockDetectTargets).toHaveBeenCalled();
      expect(mockImage.extract).toHaveBeenCalled();
      expect(result.fallbackApplied).toBe(false);
      expect(result.targetsFound).toBe(1);
      expect(result.detectionMethods).toContain('DetectFaces');
    });

    it('should pass solver output to sharp.extract', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(1)]]));

      await service.execute(mockImage, { faces: true });

      const extractArg = mockImage.extract.mock.calls[0][0];
      expect(extractArg).toHaveProperty('left');
      expect(extractArg).toHaveProperty('top');
      expect(extractArg).toHaveProperty('width');
      expect(extractArg).toHaveProperty('height');
    });

    it('should handle multiple detection methods', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map<RekognitionApiName, DetectionResult>([
        ['DetectFaces', makeFaceDetections(1)],
        ['DetectLabels', makeLabelDetections([{ name: 'Cat', confidence: 95 }])],
      ]));

      const result = await service.execute(mockImage, { faces: true, labels: ['Cat'] });

      expect(result.targetsFound).toBe(2);
      expect(result.fallbackApplied).toBe(false);
    });
  });

  // ─── execute: metadata validation ──────────────────────────────────────────

  describe('execute — metadata validation', () => {
    it('should throw when metadata.width is undefined', async () => {
      const mockImage = createMockSharp();
      mockImage.metadata.mockResolvedValue({ format: 'jpeg', height: 600 });
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(1)]]));

      await expect(service.execute(mockImage, { faces: true })).rejects.toThrow('Unable to determine image dimensions from metadata');
    });

    it('should throw when metadata.height is undefined', async () => {
      const mockImage = createMockSharp();
      mockImage.metadata.mockResolvedValue({ format: 'jpeg', width: 800 });
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(1)]]));

      await expect(service.execute(mockImage, { faces: true })).rejects.toThrow('Unable to determine image dimensions from metadata');
    });
  });

  // ─── execute: faceIndex filtering ─────────────────────────────────────────

  describe('execute — faceIndex filtering', () => {
    it('should select face by faceIndex', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(3)]]));

      const result = await service.execute(mockImage, { faces: true, faceIndex: 1 });

      expect(result.targetsFound).toBe(1);
      expect(result.fallbackApplied).toBe(false);
    });

    it('should fallback when faceIndex out of range', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(1)]]));

      const result = await service.execute(mockImage, { faces: true, faceIndex: 5 });

      expect(result.fallbackApplied).toBe(true);
    });
  });

  // ─── execute: confidence filtering ────────────────────────────────────────

  describe('execute — confidence filtering', () => {
    it('should filter by minConfidence', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectFaces', makeFaceDetections(1, 50)],
      ]));

      const result = await service.execute(mockImage, { faces: true, minConfidence: 80 });

      expect(result.fallbackApplied).toBe(true);
      expect(result.fallbackReason).toBe('no_targets_above_threshold');
    });

    it('should keep detections at exactly minConfidence', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', makeFaceDetections(1, 80)]]));

      const result = await service.execute(mockImage, { faces: true, minConfidence: 80 });

      expect(result.fallbackApplied).toBe(false);
      expect(result.targetsFound).toBe(1);
    });
  });

  // ─── execute: label filtering ─────────────────────────────────────────────

  describe('execute — label filtering', () => {
    it('should filter to requested labels only', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectLabels', makeLabelDetections([
          { name: 'Cat', confidence: 95 },
          { name: 'Dog', confidence: 90 },
          { name: 'Tree', confidence: 85 },
        ])],
      ]));

      const result = await service.execute(mockImage, { labels: ['Cat', 'Dog'] });

      expect(result.targetsFound).toBe(2);
    });

    it('should match labels case-insensitively', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectLabels', makeLabelDetections([{ name: 'Cat', confidence: 95 }])],
      ]));

      const result = await service.execute(mockImage, { labels: ['cat'] });

      expect(result.targetsFound).toBe(1);
    });

    it('should exclude Logo boxes when retainLogo is false', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectLabels', makeLabelDetections([
          { name: 'Cat', confidence: 95 },
          { name: 'Logo', confidence: 90 },
        ])],
      ]));

      const result = await service.execute(mockImage, { labels: ['Cat'], retainLogo: false });

      expect(result.targetsFound).toBe(1);
    });

    it('should include Logo boxes when retainLogo is true', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectLabels', makeLabelDetections([
          { name: 'Cat', confidence: 95 },
          { name: 'Logo', confidence: 90 },
        ])],
      ]));

      const result = await service.execute(mockImage, { labels: ['Cat'], retainLogo: true });

      expect(result.targetsFound).toBe(2);
    });

    it('should exclude Text boxes when retainText is false', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectLabels', makeLabelDetections([
          { name: 'Cat', confidence: 95 },
          { name: 'Text', confidence: 88 },
        ])],
      ]));

      const result = await service.execute(mockImage, { labels: ['Cat'], retainText: false });

      expect(result.targetsFound).toBe(1);
    });

    it('should include Text boxes when retainText is true', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectLabels', makeLabelDetections([
          { name: 'Cat', confidence: 95 },
          { name: 'Text', confidence: 88 },
        ])],
      ]));

      const result = await service.execute(mockImage, { labels: ['Cat'], retainText: true });

      expect(result.targetsFound).toBe(2);
    });
  });

  // ─── execute: fallback paths ──────────────────────────────────────────────

  describe('execute — fallback', () => {
    it('should fallback when no detection methods enabled', async () => {
      const mockImage = createMockSharp();

      const result = await service.execute(mockImage, {});

      expect(result.fallbackApplied).toBe(true);
      expect(result.fallbackReason).toBe('no_detection_methods_enabled');
      expect(mockDetectTargets).not.toHaveBeenCalled();
    });

    it('should fallback when detectTargets throws', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockRejectedValue(new Error('Rekognition unavailable'));

      const result = await service.execute(mockImage, { faces: true });

      expect(result.fallbackApplied).toBe(true);
      expect(result.fallbackReason).toBe('detection_error');
    });

    it('should fallback when no bounding boxes returned', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [] }],
      ]));

      const result = await service.execute(mockImage, { faces: true });

      expect(result.fallbackApplied).toBe(true);
      expect(result.fallbackReason).toBe('no_targets_above_threshold');
    });

    it('should resize with aspect ratio on cover fallback', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [] }],
      ]));

      await service.execute(
        mockImage,
        { faces: true, aspectRatio: '16:9', fallback: 'cover' },
      );

      expect(mockImage.resize).toHaveBeenCalledWith(800, 450, { fit: 'cover' });
    });

    it('should not resize on no-crop fallback', async () => {
      const mockImage = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [] }],
      ]));

      await service.execute(
        mockImage,
        { faces: true, fallback: 'no-crop' },
      );

      expect(mockImage.resize).not.toHaveBeenCalled();
    });

    it('should clamp fallback resize output proportionally for extreme aspect ratios', async () => {
      // aspectRatio 1:100 with no detection method -> requiredApis empty -> applyFallback.
      // Source 4000x3000 -> requested resize would be 4000 x round(4000*100/1)=400000,
      // an unbounded output. The clamp must cap it to <= MAX_OUTPUT_DIMENSION (8192) per
      // side while preserving the 1:100 ratio (width ~= height/100).
      const mockImage = createMockSharp({ width: 4000, height: 3000, format: 'jpeg' });

      await service.execute(
        mockImage,
        { aspectRatio: '1:100', fallback: 'cover' },
      );

      expect(mockDetectTargets).not.toHaveBeenCalled();
      expect(mockImage.resize).toHaveBeenCalledTimes(1);
      const [clampedWidth, clampedHeight, opts] = mockImage.resize.mock.calls[0];
      expect(clampedHeight).toBeLessThanOrEqual(8192);
      expect(clampedWidth).toBeLessThanOrEqual(8192);
      expect(clampedWidth * clampedHeight).toBeLessThanOrEqual(8192 * 8192);
      expect(clampedHeight).not.toBe(400000);
      // 1:100 ratio preserved: width ~= height / 100 (within rounding)
      expect(clampedWidth).toBe(Math.max(1, Math.round(clampedHeight / 100)));
      expect(opts).toEqual({ fit: 'cover' });
    });

    it('should not clamp fallback resize for a normal aspect ratio within limits', async () => {
      // aspectRatio 16:9 on a small source -> 200 x round(200*9/16)=113, well within cap.
      const mockImage = createMockSharp({ width: 200, height: 150, format: 'jpeg' });

      await service.execute(
        mockImage,
        { aspectRatio: '16:9', fallback: 'cover' },
      );

      expect(mockImage.resize).toHaveBeenCalledTimes(1);
      expect(mockImage.resize).toHaveBeenCalledWith(200, 113, { fit: 'cover' });
    });

    it('should throw when fallback metadata has no dimensions', async () => {
      const mockImage = createMockSharp();
      mockImage.metadata.mockResolvedValue({ format: 'jpeg' });

      await expect(service.execute(mockImage, {})).rejects.toThrow('Unable to determine image dimensions from metadata');
    });
  });

  // ─── execute: validation errors propagate ─────────────────────────────────

  describe('execute — validation', () => {
    it('should throw SmartCropValidationError for invalid params', async () => {
      const mockImage = createMockSharp();

      await expect(
        service.execute(mockImage, 'invalid'),
      ).rejects.toThrow(SmartCropValidationError);
    });
  });

  // ─── getRekognitionCompatibleImage ────────────────────────────────────────

  describe('getRekognitionCompatibleImage', () => {
    it('should return jpeg image unchanged when under 5MB', async () => {
      const mockImage = createMockSharp({ width: 100, height: 100, format: 'jpeg' as const });
      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);
      expect(result.format).toBe('jpeg');
      expect(mockSharp).not.toHaveBeenCalled();
    });

    it('should return png image unchanged when under 5MB', async () => {
      const mockImage = createMockSharp({ width: 100, height: 100, format: 'png' as const });
      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);
      expect(result.format).toBe('png');
      expect(mockSharp).not.toHaveBeenCalled();
    });

    it('should convert webp to png', async () => {
      const mockImage = createMockSharp({ width: 100, height: 100, format: 'webp' as const });
      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);
      expect(result.format).toBe('png');
      expect(mockImage.png).toHaveBeenCalled();
    });

    it('should resize jpeg image when over 5MB', async () => {
      const oversizedBuffer = { length: 5 * 1024 * 1024 + 1 } as unknown as Buffer;
      const smallBuffer = { length: 4 * 1024 * 1024 } as unknown as Buffer;
      const mockImage: any = {
        toBuffer: jest.fn().mockResolvedValue({
          data: oversizedBuffer,
          info: { format: 'jpeg', width: 4000, height: 3000, channels: 3, size: oversizedBuffer.length, premultiplied: false },
        }),
        png: jest.fn(),
      };

      mockSharpToBuffer.mockResolvedValue({
        data: smallBuffer,
        info: { format: 'jpeg', width: 3000, height: 2250, channels: 3, size: smallBuffer.length, premultiplied: false },
      });

      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);

      expect(result.format).toBe('jpeg');
      expect(result.imageBuffer.data.length).toBeLessThanOrEqual(5 * 1024 * 1024);
      expect(mockSharp).toHaveBeenCalledWith(oversizedBuffer);
      expect(mockResize).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        { fit: 'inside' },
      );
    });

    it('should resize png image when over 5MB', async () => {
      const oversizedBuffer = { length: 5 * 1024 * 1024 + 1 } as unknown as Buffer;
      const smallBuffer = { length: 4 * 1024 * 1024 } as unknown as Buffer;
      const mockImage: any = {
        toBuffer: jest.fn().mockResolvedValue({
          data: oversizedBuffer,
          info: { format: 'png', width: 5000, height: 4000, channels: 4, size: oversizedBuffer.length, premultiplied: false },
        }),
        png: jest.fn(),
      };

      mockSharpToBuffer.mockResolvedValue({
        data: smallBuffer,
        info: { format: 'png', width: 3500, height: 2800, channels: 4, size: smallBuffer.length, premultiplied: false },
      });

      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);

      expect(result.format).toBe('png');
      expect(result.imageBuffer.data.length).toBeLessThanOrEqual(5 * 1024 * 1024);
      expect(mockSharp).toHaveBeenCalledWith(oversizedBuffer);
      expect(mockResize).toHaveBeenCalled();
    });

    it('should halve dimensions in fallback when first resize is still over 5MB', async () => {
      const oversizedBuffer = { length: 10 * 1024 * 1024 } as unknown as Buffer;
      const stillOversizedBuffer = { length: 6 * 1024 * 1024 } as unknown as Buffer;
      const smallBuffer = { length: 3 * 1024 * 1024 } as unknown as Buffer;
      const mockImage: any = {
        toBuffer: jest.fn().mockResolvedValue({
          data: oversizedBuffer,
          info: { format: 'jpeg', width: 6000, height: 4000, channels: 3, size: oversizedBuffer.length, premultiplied: false },
        }),
        png: jest.fn(),
      };

      // First resize still over limit, second resize under
      mockSharpToBuffer
        .mockResolvedValueOnce({
          data: stillOversizedBuffer,
          info: { format: 'jpeg', width: 4000, height: 2666, channels: 3, size: stillOversizedBuffer.length, premultiplied: false },
        })
        .mockResolvedValueOnce({
          data: smallBuffer,
          info: { format: 'jpeg', width: 2000, height: 1333, channels: 3, size: smallBuffer.length, premultiplied: false },
        });

      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);

      expect(result.imageBuffer.data.length).toBeLessThanOrEqual(5 * 1024 * 1024);
      // sharp() called twice: once for pixel-budget resize, once for fallback halving
      expect(mockSharp).toHaveBeenCalledTimes(2);
    });

    it('should apply safety margin to target pixel count', async () => {
      const oversizedBuffer = { length: 6 * 1024 * 1024 } as unknown as Buffer;
      const smallBuffer = { length: 4 * 1024 * 1024 } as unknown as Buffer;
      const width = 4000;
      const height = 3000;
      const mockImage: any = {
        toBuffer: jest.fn().mockResolvedValue({
          data: oversizedBuffer,
          info: { format: 'jpeg', width, height, channels: 3, size: oversizedBuffer.length, premultiplied: false },
        }),
        png: jest.fn(),
      };

      mockSharpToBuffer.mockResolvedValue({
        data: smallBuffer,
        info: { format: 'jpeg', width: 3000, height: 2250, channels: 3, size: smallBuffer.length, premultiplied: false },
      });

      await SmartCropService.getRekognitionCompatibleImage(mockImage);

      // Verify resize dimensions account for safety margin (0.85)
      const [resizeWidth, resizeHeight] = mockResize.mock.calls[0] as unknown as [number, number];
      const bpp = oversizedBuffer.length / (width * height);
      const maxPixels = (5 * 1024 * 1024 / bpp) * 0.85;
      const expectedScale = Math.sqrt(maxPixels / (width * height));
      expect(resizeWidth).toBe(Math.floor(width * expectedScale));
      expect(resizeHeight).toBe(Math.floor(height * expectedScale));
    });

    it('should convert webp to png and resize when converted result exceeds 5MB', async () => {
      const webpBuffer = Buffer.from('fake-webp');
      const oversizedPngBuffer = { length: 6 * 1024 * 1024 } as unknown as Buffer;
      const smallPngBuffer = { length: 4 * 1024 * 1024 } as unknown as Buffer;
      const mockImage: any = {
        toBuffer: jest.fn().mockResolvedValue({
          data: webpBuffer,
          info: { format: 'webp', width: 4000, height: 3000, channels: 4, size: webpBuffer.length, premultiplied: false },
        }),
        png: jest.fn().mockReturnValue({
          toBuffer: jest.fn().mockResolvedValue({
            data: oversizedPngBuffer,
            info: { format: 'png', width: 4000, height: 3000, channels: 4, size: oversizedPngBuffer.length, premultiplied: false },
          }),
        }),
      };

      mockSharpToBuffer.mockResolvedValue({
        data: smallPngBuffer,
        info: { format: 'png', width: 3000, height: 2250, channels: 4, size: smallPngBuffer.length, premultiplied: false },
      });

      const result = await SmartCropService.getRekognitionCompatibleImage(mockImage);

      expect(result.format).toBe('png');
      expect(result.imageBuffer.data.length).toBeLessThanOrEqual(5 * 1024 * 1024);
      expect(mockImage.png).toHaveBeenCalled();
      expect(mockSharp).toHaveBeenCalledWith(oversizedPngBuffer);
      expect(mockResize).toHaveBeenCalled();
      expect(mockPng).toHaveBeenCalled();
    });
  });
});
