// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { Sharp, FitEnum, OutputInfo } from 'sharp';
import { RekognitionService } from '../rekognition/rekognition.service';
import { RekognitionReadThroughCache } from '../rekognition/rekognition-read-through-cache';
import { RekognitionCacheDao } from '../rekognition/rekognition-cache-dao';
import { RekognitionClient } from '../rekognition/rekognition-client';
import { DetectionResult, NormalizedBoundingBox, RekognitionApiName } from '../rekognition/types';
import { SmartCropParser } from './smart-crop-parser';
import { computeUnionBBox, filterDetections, solve } from './crop-resolver';
import {
  Constraint,
  CropRegion,
  ParsedSmartCropConfig,
  SmartCropResult,
} from './types';

// Fallback output ceilings: an extreme aspectRatio (e.g. 1:100) could otherwise request an
// unbounded output buffer from sharp (LIMIT_INPUT_PIXELS only bounds decode input, not output).
const MAX_OUTPUT_DIMENSION = 8192; // per-side ceiling
const MAX_OUTPUT_PIXELS = MAX_OUTPUT_DIMENSION * MAX_OUTPUT_DIMENSION; // total-pixel ceiling

export class SmartCropService {
  private static instance: SmartCropService;
  private rekognitionService: RekognitionService;

  constructor(rekognitionService: RekognitionService) {
    this.rekognitionService = rekognitionService;
  }

  static getInstance(): SmartCropService {
    if (!SmartCropService.instance) {
      const dao = new RekognitionCacheDao();
      const client = new RekognitionClient();
      const cache = new RekognitionReadThroughCache(dao, client);
      SmartCropService.instance = new SmartCropService(new RekognitionService(cache));
    }
    return SmartCropService.instance;
  }

  async execute(
    image: Sharp,
    smartCropParams: unknown,
  ): Promise<SmartCropResult> {
    const config = SmartCropParser.parse(smartCropParams);
    const requiredApis = this.determineRequiredApis(config);

    if (requiredApis.length === 0) {
      return this.applyFallback(image, config, 'no_detection_methods_enabled');
    }

    let detections: Map<RekognitionApiName, DetectionResult>;
    try {
      const { imageBuffer } = await SmartCropService.getRekognitionCompatibleImage(image);
      detections = await this.rekognitionService.detectTargets({
        imageBytes: imageBuffer.data,
        requiredApis,
        customModelArn: config.customModelArn,
      });
    } catch (error) {
      console.log(JSON.stringify({ component: 'SmartCropService', event: 'detection_failed', error: (error as Error)?.message }));
      return this.applyFallback(image, config, 'detection_error');
    }

    const allBoxes = this.collectBoundingBoxes(detections);
    const filtered = this.filterDetectionResults(allBoxes, config);

    if (filtered.length === 0) {
      const detectedLabels = [...new Set(allBoxes.map((b) => b.label).filter(Boolean))];
      console.log(JSON.stringify({
        component: 'SmartCropService',
        event: 'no_targets_matched',
        requestedLabels: config.labels,
        detectedLabels,
        minConfidence: config.minConfidence,
        totalDetections: allBoxes.length,
      }));
      return this.applyFallback(image, config, 'no_targets_above_threshold');
    }

    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions from metadata');
    }
    const imageDimensions = { width: metadata.width, height: metadata.height };

    const unionBBox = computeUnionBBox(filtered, imageDimensions);
    const constraints = this.buildConstraints(config);
    const gravityLabelBBoxes = this.resolveGravityLabelBBoxes(config, filtered, imageDimensions);

    const solverOutput = solve({
      unionBBox,
      imageDimensions,
      constraints,
      gravity: config.gravity,
      gravityLabelBBoxes,
    });

    image.extract(solverOutput.cropRegion);

    const result: SmartCropResult = {
      ...solverOutput,
      detectionMethods: requiredApis,
      targetsFound: filtered.length,
      fallbackApplied: false,
    };

    console.log(JSON.stringify({
      component: 'SmartCropService',
      event: 'smart_crop_complete',
      detectionMethods: result.detectionMethods,
      targetsFound: result.targetsFound,
      confidenceScores: filtered.map((b) => Math.round(b.confidence)),
      cropRegion: result.cropRegion,
      constraintSatisfaction: Object.fromEntries(result.constraintSatisfaction),
    }));

    return result;
  }

  determineRequiredApis(config: ParsedSmartCropConfig): RekognitionApiName[] {
    const apis = new Set<RekognitionApiName>();
    if (config.faces || config.faceIndex !== undefined) apis.add('DetectFaces');
    // Logo is a standard Rekognition label — detected via DetectLabels
    if (config.labels.length > 0 || config.retainLogo) apis.add('DetectLabels');
    if (config.retainText) apis.add('DetectText');
    if (config.customModelArn) apis.add('DetectCustomLabels');
    return [...apis];
  }

  private collectBoundingBoxes(detections: Map<RekognitionApiName, DetectionResult>): NormalizedBoundingBox[] {
    const boxes: NormalizedBoundingBox[] = [];
    for (const detection of detections.values()) {
      boxes.push(...detection.boundingBoxes);
    }
    return boxes;
  }

  private filterDetectionResults(
    boxes: NormalizedBoundingBox[],
    config: ParsedSmartCropConfig,
  ): NormalizedBoundingBox[] {
    let filtered = filterDetections(boxes, config.minConfidence);

    if (config.faceIndex !== undefined) {
      const faces = filtered.filter((b) => b.label === 'Face');
      const nonFaces = filtered.filter((b) => b.label !== 'Face');
      const selectedFace = faces[config.faceIndex];
      filtered = selectedFace ? [selectedFace, ...nonFaces] : nonFaces;
    }

    if (config.labels.length > 0) {
      const labelSet = new Set(config.labels.map((l) => l.toLowerCase()));
      // Face, Logo, Text boxes from retainText/retainLogo always pass through
      filtered = filtered.filter((b) => {
        if (!b.label) return true;
        return labelSet.has(b.label.toLowerCase()) || b.label === 'Face' || (b.label === 'Logo' && config.retainLogo) || (b.label === 'Text' && config.retainText);
      });
    }

    return filtered;
  }

  private buildConstraints(config: ParsedSmartCropConfig): Constraint[] {
    return config.priorities
      .map((type): Constraint | null => {
        if (type === 'aspectRatio' && config.aspectRatio) {
          return { type: 'aspectRatio', config: config.aspectRatio };
        }
        if (type === 'padding') {
          return { type: 'padding', config: config.padding };
        }
        return null;
      })
      .filter((c): c is Constraint => c !== null);
  }

  private resolveGravityLabelBBoxes(
    config: ParsedSmartCropConfig,
    filtered: NormalizedBoundingBox[],
    imageDimensions: { width: number; height: number },
  ): CropRegion[] | undefined {
    if (config.gravity.type !== 'label') return undefined;
    const labelName = config.gravity.labelName.toLowerCase();
    const matching = filtered.filter((b) => b.label?.toLowerCase() === labelName);
    if (matching.length === 0) {
      console.log(JSON.stringify({ component: 'SmartCropService', event: 'gravity_label_not_found', label: config.gravity.labelName }));
      return [];
    }
    return matching.map((b) => ({
      left: Math.floor(b.left * imageDimensions.width),
      top: Math.floor(b.top * imageDimensions.height),
      width: Math.ceil(b.width * imageDimensions.width),
      height: Math.ceil(b.height * imageDimensions.height),
    }));
  }

  private async applyFallback(
    image: Sharp,
    config: ParsedSmartCropConfig,
    reason: string,
  ): Promise<SmartCropResult> {
    console.log(JSON.stringify({ component: 'SmartCropService', event: 'fallback_applied', reason, strategy: config.fallback }));

    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions from metadata');
    }
    const width = metadata.width;
    const height = metadata.height;

    if (config.fallback !== 'no-crop' && config.aspectRatio) {
      let targetWidth = width;
      let targetHeight = Math.round((width * config.aspectRatio.h) / config.aspectRatio.w);

      // Scale both dims down proportionally to stay within the output ceilings.
      if (
        targetWidth > MAX_OUTPUT_DIMENSION ||
        targetHeight > MAX_OUTPUT_DIMENSION ||
        targetWidth * targetHeight > MAX_OUTPUT_PIXELS
      ) {
        const scale = Math.min(
          MAX_OUTPUT_DIMENSION / targetWidth,
          MAX_OUTPUT_DIMENSION / targetHeight,
          Math.sqrt(MAX_OUTPUT_PIXELS / (targetWidth * targetHeight)),
        );
        const requested = { width: targetWidth, height: targetHeight };
        targetWidth = Math.max(1, Math.round(targetWidth * scale));
        targetHeight = Math.max(1, Math.round(targetHeight * scale));
        console.log(JSON.stringify({
          component: 'SmartCropService',
          event: 'fallback_resize_clamped',
          requested,
          clamped: { width: targetWidth, height: targetHeight },
        }));
      }

      image.resize(targetWidth, targetHeight, { fit: config.fallback as keyof FitEnum });
    }

    return {
      cropRegion: { left: 0, top: 0, width, height },
      constraintSatisfaction: new Map(),
      detectionMethods: [],
      targetsFound: 0,
      fallbackApplied: true,
      fallbackReason: reason,
    };
  }

  private static readonly REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;
  private static readonly RESIZE_SAFETY_MARGIN = 0.85;

  static async getRekognitionCompatibleImage(image: Sharp): Promise<{
    imageBuffer: { data: Buffer; info: OutputInfo };
    format: string;
  }> {
    const buffer = await image.toBuffer({ resolveWithObject: true });
    const format = buffer.info.format;
    let result: { data: Buffer; info: OutputInfo };
    let outputFormat: string;

    if (['jpeg', 'png'].includes(format)) {
      result = buffer;
      outputFormat = format;
    } else {
      // Rekognition only accepts JPEG/PNG — convert other formats to PNG
      result = await image.png().toBuffer({ resolveWithObject: true });
      outputFormat = 'png';
      console.log(`Bad format: ${format}, being converted to png`);
    }

    if (result.data.length <= SmartCropService.REKOGNITION_MAX_BYTES) {
      return { imageBuffer: result, format: outputFormat };
    }

    // Pixel-budget resize: use actual bytes-per-pixel to estimate target dimensions
    let { width, height } = result.info;
    const currentPixels = width * height;
    const bytesPerPixel = result.data.length / currentPixels;
    const maxPixels = (SmartCropService.REKOGNITION_MAX_BYTES / bytesPerPixel) * SmartCropService.RESIZE_SAFETY_MARGIN;
    const scale = Math.sqrt(maxPixels / currentPixels);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);

    const encode = (img: Sharp) =>
      outputFormat === 'jpeg' ? img.jpeg().toBuffer({ resolveWithObject: true }) : img.png().toBuffer({ resolveWithObject: true });

    result = await encode(sharp(result.data).resize(width, height, { fit: 'inside' }));

    // Safety fallback: if still over limit, keep halving until under
    while (result.data.length > SmartCropService.REKOGNITION_MAX_BYTES) {
      width = Math.floor(result.info.width / 2);
      height = Math.floor(result.info.height / 2);
      result = await encode(sharp(result.data).resize(width, height, { fit: 'inside' }));
    }

    console.log(JSON.stringify({
      component: 'SmartCropService',
      event: 'rekognition_image_resized',
      originalSize: buffer.data.length,
      finalSize: result.data.length,
      finalDimensions: { width: result.info.width, height: result.info.height },
    }));

    return { imageBuffer: result, format: outputFormat };
  }
}
