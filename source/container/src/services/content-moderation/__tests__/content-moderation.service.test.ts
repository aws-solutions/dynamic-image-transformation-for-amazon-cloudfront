// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ContentModerationService } from '../content-moderation.service';
import { RekognitionService } from '../../rekognition/rekognition.service';
import { DetectionResult } from '../../rekognition/types';
import { SmartCropService } from '../../smart-crop/smart-crop.service';

const mockDetectTargets = jest.fn();
const mockRekognitionService = { detectTargets: mockDetectTargets } as unknown as RekognitionService;

const mockBlur = jest.fn().mockReturnThis();
const createMockSharp = () => {
  const bufferData = Buffer.from('fake-image');
  return {
    metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, format: 'jpeg' }),
    toBuffer: jest.fn().mockResolvedValue({ data: bufferData, info: { format: 'jpeg', width: 100, height: 100, channels: 3, size: bufferData.length, premultiplied: false } }),
    blur: mockBlur,
    png: jest.fn().mockReturnValue({
      toBuffer: jest.fn().mockResolvedValue({ data: bufferData, info: { format: 'png', width: 100, height: 100, channels: 3, size: bufferData.length, premultiplied: false } }),
    }),
  } as any;
};

const makeModerationDetections = (labels: { name: string; confidence: number }[]): DetectionResult => ({
  apiName: 'DetectModerationLabels',
  boundingBoxes: labels.map((l) => ({
    left: 0, top: 0, width: 0, height: 0,
    label: l.name,
    confidence: l.confidence,
  })),
});

jest.spyOn(SmartCropService, 'getRekognitionCompatibleImage').mockImplementation(async (image: any) => {
  const buffer = await image.toBuffer({ resolveWithObject: true });
  return { imageBuffer: buffer, format: buffer.info.format };
});

describe('ContentModerationService', () => {
  let service: ContentModerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentModerationService(mockRekognitionService);
  });

  // ─── resolveConfig ──────────────────────────────────────────────────────────

  describe('resolveConfig', () => {
    it('should return all defaults for boolean true', () => {
      expect(ContentModerationService.resolveConfig(true)).toEqual({
        minConfidence: 75, blur: 50, moderationLabels: [],
      });
    });

    it('should return all defaults for empty object', () => {
      expect(ContentModerationService.resolveConfig({})).toEqual({
        minConfidence: 75, blur: 50, moderationLabels: [],
      });
    });

    it('should preserve minConfidence and default the rest', () => {
      expect(ContentModerationService.resolveConfig({ minConfidence: 60 })).toEqual({
        minConfidence: 60, blur: 50, moderationLabels: [],
      });
    });

    it('should preserve blur and default the rest', () => {
      expect(ContentModerationService.resolveConfig({ blur: 100 })).toEqual({
        minConfidence: 75, blur: 100, moderationLabels: [],
      });
    });

    it('should preserve moderationLabels and default the rest', () => {
      expect(ContentModerationService.resolveConfig({ moderationLabels: ['Smoking'] })).toEqual({
        minConfidence: 75, blur: 50, moderationLabels: ['Smoking'],
      });
    });

    it('should preserve all fields when fully specified', () => {
      const config = { minConfidence: 60, blur: 100, moderationLabels: ['Violence', 'Smoking'] };
      expect(ContentModerationService.resolveConfig(config)).toEqual(config);
    });
  });

  // ─── execute: blur decision ─────────────────────────────────────────────────

  describe('execute — blur decision', () => {
    it('should blur when labels detected and moderationLabels is empty (match all)', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 90 }])],
      ]));

      await service.execute(image, true);

      expect(mockBlur).toHaveBeenCalledWith(50);
    });

    it('should not blur when no labels detected', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([])],
      ]));

      await service.execute(image, true);

      expect(mockBlur).not.toHaveBeenCalled();
    });

    it('should blur when detected label matches configured list', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([
          { name: 'Smoking', confidence: 90 },
          { name: 'Violence', confidence: 85 },
        ])],
      ]));

      await service.execute(image, { moderationLabels: ['Smoking'] });

      expect(mockBlur).toHaveBeenCalled();
    });

    it('should not blur when detected labels do not match configured list', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 90 }])],
      ]));

      await service.execute(image, { moderationLabels: ['Violence'] });

      expect(mockBlur).not.toHaveBeenCalled();
    });

    it('should not blur when confidence is below minConfidence', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 50 }])],
      ]));

      await service.execute(image, { minConfidence: 75 });

      expect(mockBlur).not.toHaveBeenCalled();
    });

    it('should blur when confidence equals minConfidence exactly', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 75 }])],
      ]));

      await service.execute(image, { minConfidence: 75 });

      expect(mockBlur).toHaveBeenCalled();
    });

    it('should not blur when DetectModerationLabels result is missing from map', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map());

      await service.execute(image, true);

      expect(mockBlur).not.toHaveBeenCalled();
    });
  });

  // ─── execute: blur value ceiling ────────────────────────────────────────────

  describe('execute — blur ceiling', () => {
    it('should ceil fractional blur value', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 90 }])],
      ]));

      await service.execute(image, { blur: 0.3 });

      expect(mockBlur).toHaveBeenCalledWith(1);
    });

    it('should pass integer blur value unchanged', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 90 }])],
      ]));

      await service.execute(image, { blur: 100 });

      expect(mockBlur).toHaveBeenCalledWith(100);
    });

    it('should ceil 50.1 to 51', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([{ name: 'Smoking', confidence: 90 }])],
      ]));

      await service.execute(image, { blur: 50.1 });

      expect(mockBlur).toHaveBeenCalledWith(51);
    });
  });

  // ─── execute: error propagation ─────────────────────────────────────────────

  describe('execute — error propagation', () => {
    it('should propagate Rekognition errors (fail-closed)', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockRejectedValue(new Error('Rekognition service error'));

      await expect(service.execute(image, true)).rejects.toThrow('Rekognition service error');
      expect(mockBlur).not.toHaveBeenCalled();
    });
  });

  // ─── execute: Rekognition API call ──────────────────────────────────────────

  describe('execute — Rekognition integration', () => {
    it('should call detectTargets with DetectModerationLabels', async () => {
      const image = createMockSharp();
      mockDetectTargets.mockResolvedValue(new Map([
        ['DetectModerationLabels', makeModerationDetections([])],
      ]));

      await service.execute(image, true);

      expect(mockDetectTargets).toHaveBeenCalledWith({
        imageBytes: expect.any(Buffer),
        requiredApis: ['DetectModerationLabels'],
      });
    });
  });
});
