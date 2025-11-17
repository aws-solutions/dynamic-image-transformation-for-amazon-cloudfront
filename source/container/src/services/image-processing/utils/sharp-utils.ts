// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp from 'sharp';
import { ImageProcessingError } from '../types';

export class SharpUtils {
  static readonly ALLOWED_TRANSFORMATIONS = [
    'flatten', 'blur', 'resize', 'convolve', 'extract', 'normalize', 'flip', 'flop', 'greyscale', 'grayscale',
    'tint', 'rotate', 'sharpen', 'toFormat', 'composite'
  ]; 

  static isAllowedTransformation(type: string): boolean {
    if (!this.ALLOWED_TRANSFORMATIONS.includes(type)) {console.log(`The following transformation: ${type}, was blocked from being applied`)}
    return this.ALLOWED_TRANSFORMATIONS.includes(type);
  }

  static getDefaultSharpOptions(): any {
    const { SHARP_SIZE_LIMIT } = process.env;
    const limitInputPixels = SHARP_SIZE_LIMIT === '' || isNaN(Number(SHARP_SIZE_LIMIT)) || Number(SHARP_SIZE_LIMIT);
    
    return {
      failOnError: false,
      animated: false,
      limitInputPixels,
      sequentialRead: true
    };
  }

  static convertImageFormatType(imageFormatType: string): keyof sharp.FormatEnum {
    switch (imageFormatType.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'webp':
        return 'webp';
      case 'tiff':
        return 'tiff';
      case 'heif':
        return 'heif';
      case 'raw':
        return 'raw';
      case 'gif':
        return 'gif';
      case 'avif':
        return 'avif';
      default:
        throw new ImageProcessingError(
          500,
          'UnsupportedOutputImageFormatException',
          `Format ${imageFormatType} not supported`
        );
    }
  }

  static shouldSkipForAnimation(transformationType: string, isAnimation: boolean): boolean {
    const skipForAnimation = ['rotate', 'smart_crop', 'round_crop', 'content_moderation'];
    return isAnimation && skipForAnimation.includes(transformationType);
  }
}