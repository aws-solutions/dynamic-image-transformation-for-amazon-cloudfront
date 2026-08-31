// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { Sharp } from 'sharp';
import { RekognitionService } from '../rekognition/rekognition.service';
import { RekognitionReadThroughCache } from '../rekognition/rekognition-read-through-cache';
import { RekognitionCacheDao } from '../rekognition/rekognition-cache-dao';
import { RekognitionClient } from '../rekognition/rekognition-client';
import { SmartCropService } from '../smart-crop/smart-crop.service';
import { ContentModerationConfig, resolveModerationConfig } from './content-moderation-config';

export class ContentModerationService {
  private static instance: ContentModerationService;
  private rekognitionService: RekognitionService;

  constructor(rekognitionService: RekognitionService) {
    this.rekognitionService = rekognitionService;
  }

  static getInstance(): ContentModerationService {
    if (!ContentModerationService.instance) {
      const dao = new RekognitionCacheDao();
      const client = new RekognitionClient();
      const cache = new RekognitionReadThroughCache(dao, client);
      ContentModerationService.instance = new ContentModerationService(new RekognitionService(cache));
    }
    return ContentModerationService.instance;
  }

  static resolveConfig(params: true | Partial<ContentModerationConfig>): ContentModerationConfig {
    return resolveModerationConfig(params);
  }

  async execute(image: Sharp, params: true | Partial<ContentModerationConfig>): Promise<void> {
    const config = ContentModerationService.resolveConfig(params);
    const { imageBuffer } = await SmartCropService.getRekognitionCompatibleImage(image);

    const detections = await this.rekognitionService.detectTargets({
      imageBytes: imageBuffer.data,
      requiredApis: ['DetectModerationLabels'],
    });

    const result = detections.get('DetectModerationLabels');
    if (!result) return;

    const matched = result.boundingBoxes.filter((box) => {
      if (box.confidence < config.minConfidence) return false;
      if (config.moderationLabels.length === 0) return true;
      return config.moderationLabels.includes(box.label ?? '');
    });

    if (matched.length > 0) {
      image.blur(Math.ceil(config.blur));
      console.log(JSON.stringify({
        component: 'ContentModerationService',
        event: 'blur_applied',
        matchedLabels: matched.map((m) => m.label),
      }));
    }
  }
}
