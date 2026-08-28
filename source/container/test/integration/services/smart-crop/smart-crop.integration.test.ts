// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { Sharp } from 'sharp';
import { SmartCropService } from '../../../../src/services/smart-crop/smart-crop.service';
import { RekognitionService } from '../../../../src/services/rekognition/rekognition.service';
import { DetectionResult, RekognitionApiName } from '../../../../src/services/rekognition/types';

// ─── Test fixtures ──────────────────────────────────────────────────────────────

let jpegBuffer: Buffer; // 800×600
let webpBuffer: Buffer; // 300×200

const FACE_A = { left: 0.25, top: 0.25, width: 0.125, height: 0.167, label: 'Face', confidence: 99 };
const FACE_B = { left: 0.5, top: 0.33, width: 0.1, height: 0.133, label: 'Face', confidence: 95 };
const CAT = { left: 0.1, top: 0.1, width: 0.25, height: 0.25, label: 'Cat', confidence: 92 };
const EDGE_FACE = { left: 0.85, top: 0.8, width: 0.15, height: 0.2, label: 'Face', confidence: 97 };

const twoFaces: DetectionResult = { apiName: 'DetectFaces', boundingBoxes: [FACE_A, FACE_B] };
const catLabel: DetectionResult = { apiName: 'DetectLabels', boundingBoxes: [CAT] };
const emptyFaces: DetectionResult = { apiName: 'DetectFaces', boundingBoxes: [] };
const edgeFace: DetectionResult = { apiName: 'DetectFaces', boundingBoxes: [EDGE_FACE] };

// ─── Mock Rekognition ───────────────────────────────────────────────────────────

const mockDetectTargets = jest.fn();
const mockRekognitionService = { detectTargets: mockDetectTargets } as unknown as RekognitionService;

// ─── Helpers ────────────────────────────────────────────────────────────────────

const freshImage = (buf: Buffer) => sharp(Buffer.from(buf));

const assertValidImage = async (image: Sharp) => {
  const buf = await image.toBuffer();
  const meta = await sharp(buf).metadata();
  expect(meta.width).toBeGreaterThan(0);
  expect(meta.height).toBeGreaterThan(0);
  return meta;
};

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('SmartCrop Pipeline Integration', () => {
  let service: SmartCropService;

  beforeAll(async () => {
    const green = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } } })
      .png().toBuffer();

    jpegBuffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } } })
      .composite([{ input: green, left: 200, top: 150 }])
      .jpeg().toBuffer();

    webpBuffer = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 128, g: 128, b: 0 } } })
      .webp().toBuffer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SmartCropService(mockRekognitionService);
  });

  test('1. Basic face crop — two faces detected, valid output', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', twoFaces]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true });

    expect(result.fallbackApplied).toBe(false);
    expect(result.targetsFound).toBe(2);
    const meta = await assertValidImage(image);
    expect(meta.width).toBeLessThanOrEqual(800);
    expect(meta.height).toBeLessThanOrEqual(600);
  });

  test('2. Face index selection — single face, smaller crop', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', twoFaces]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true, faceIndex: 0 });

    expect(result.targetsFound).toBe(1);
    expect(result.fallbackApplied).toBe(false);
    const meta = await assertValidImage(image);
    // Single face crop should be smaller than the two-face union
    expect(meta.width).toBeLessThan(800);
    expect(meta.height).toBeLessThan(600);
  });

  test('3. Aspect ratio + face — output matches 16:9 within tolerance', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', twoFaces]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true, aspectRatio: '16:9' });

    expect(result.fallbackApplied).toBe(false);
    const meta = await assertValidImage(image);
    const actualRatio = meta.width! / meta.height!;
    expect(actualRatio).toBeCloseTo(16 / 9, 1);
  });

  test('4. Padding + face — output larger than raw face region', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [FACE_A] }]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true, faceIndex: 0, padding: '10%' });

    expect(result.fallbackApplied).toBe(false);
    const meta = await assertValidImage(image);
    // Face A is 0.125×0.167 of 800×600 = 100×100px. With 10% padding, crop should be larger.
    const rawFaceWidth = Math.ceil(FACE_A.width * 800);
    const rawFaceHeight = Math.ceil(FACE_A.height * 600);
    expect(meta.width).toBeGreaterThan(rawFaceWidth);
    expect(meta.height).toBeGreaterThan(rawFaceHeight);
  });

  test('5. Label-based crop — Cat label detected', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectLabels', catLabel]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { labels: ['Cat'] });

    expect(result.targetsFound).toBe(1);
    expect(result.fallbackApplied).toBe(false);
    await assertValidImage(image);
  });

  test('6. SmartCrop + resize chain — final output is 200px wide', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', twoFaces]]));
    const image = freshImage(jpegBuffer);

    await service.execute(image, { faces: true });
    image.resize(200);
    const buf = await image.toBuffer();
    const meta = await sharp(buf).metadata();

    expect(meta.width).toBe(200);
  });

  test('7. SmartCrop + format conversion — valid WebP output', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', twoFaces]]));
    const image = freshImage(jpegBuffer);

    await service.execute(image, { faces: true });
    const buf = await image.webp().toBuffer();
    const meta = await sharp(buf).metadata();

    expect(meta.format).toBe('webp');
    expect(meta.width).toBeGreaterThan(0);
  });

  test('8. Non-JPEG/PNG input — WebP converted internally, extract still valid', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', {
      apiName: 'DetectFaces',
      boundingBoxes: [{ left: 0.2, top: 0.2, width: 0.3, height: 0.3, label: 'Face', confidence: 99 }],
    }]]));
    const image = freshImage(webpBuffer);

    const result = await service.execute(image, { faces: true });

    expect(result.fallbackApplied).toBe(false);
    await assertValidImage(image);
  });

  test('9. Fallback with real Sharp — empty detections, original dimensions preserved', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', emptyFaces]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true });

    expect(result.fallbackApplied).toBe(true);
    expect(result.fallbackReason).toBe('no_targets_above_threshold');
    const meta = await assertValidImage(image);
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  test('10. Edge crop region — face near bottom-right corner, no extract error', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', edgeFace]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true });

    expect(result.fallbackApplied).toBe(false);
    const meta = await assertValidImage(image);
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  });

  test('11. Multi-method detection — faces + labels union bbox with real Sharp', async () => {
    mockDetectTargets.mockResolvedValue(new Map<RekognitionApiName, DetectionResult>([
      ['DetectFaces', twoFaces],
      ['DetectLabels', catLabel],
    ]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true, labels: ['Cat'] });

    expect(result.fallbackApplied).toBe(false);
    expect(result.targetsFound).toBe(3);
    expect(result.detectionMethods).toContain('DetectFaces');
    expect(result.detectionMethods).toContain('DetectLabels');
    const meta = await assertValidImage(image);
    // Union of all 3 boxes spans wider than any single detection
    expect(meta.width).toBeGreaterThan(Math.ceil(FACE_A.width * 800));
  });

  test('12. Gravity top-left — crop shifts toward top-left edge', async () => {
    mockDetectTargets.mockResolvedValue(new Map([['DetectFaces', { apiName: 'DetectFaces', boundingBoxes: [FACE_A] }]]));
    const image = freshImage(jpegBuffer);

    const result = await service.execute(image, { faces: true, faceIndex: 0, gravity: 'top-left' });

    expect(result.fallbackApplied).toBe(false);
    const meta = await assertValidImage(image);
    // Crop region should be shifted toward top-left — verify extract didn't throw
    expect(result.cropRegion.left).toBeLessThanOrEqual(Math.floor(FACE_A.left * 800));
    expect(result.cropRegion.top).toBeLessThanOrEqual(Math.floor(FACE_A.top * 600));
  });
});
