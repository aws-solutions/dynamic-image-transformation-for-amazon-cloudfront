// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface TransformationPolicyTestData {
  name: string;
  description?: string;
  isDefault?: boolean;
  transformations?: Array<{ type: string; config?: any }>;
  outputs?: Array<{ type: string; config?: any }>;
}

export class TransformationPolicyFactory {
  static createBasicPolicy(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: 'Test Policy',
      description: 'Basic transformation policy for testing',
      transformations: [
        { type: 'quality', config: { quality: 80 } }
      ],
      ...overrides
    };
  }

  static createPolicyWithOutputsOnly(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: 'Output Only Policy',
      description: 'Policy with output optimizations but no transformations',
      outputs: [
        { type: 'webp', config: { quality: 85 } },
        { type: 'avif'},
        { type: 'autoSizing' }
      ],
      ...overrides
    };
  }

  static createBasicTransformationsPolicy(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: `All Basic Transformations ${Date.now()}`,
      description: 'Policy with all basic transformation options',
      transformations: [
        { type: 'resize', config: { width: 800, height: 600 } },
        { type: 'quality', config: { quality: 85 } },
        { type: 'format' },
        { type: 'rotate', config: { rotate: 90 } },
        { type: 'flip' },
        { type: 'flop' }
      ],
      ...overrides
    };
  }

  static createEffectsTransformationsPolicy(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: `Effects Transformations ${Date.now()}`,
      description: 'Policy with effects transformation options',
      transformations: [
        { type: 'blur', config: { blur: 3 } },
        { type: 'sharpen' },
        { type: 'grayscale' },
        { type: 'normalize' }
      ],
      ...overrides
    };
  }

  static createAdvancedTransformationsPolicy(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: `Advanced Transformations ${Date.now()}`,
      description: 'Policy with advanced transformation options',
      transformations: [
        { type: 'smartCrop' },
        { type: 'extract', config: { left: 0, top: 0, width: 300, height: 200 } },
        { type: 'convolve' },
        { type: 'stripExif' },
        { type: 'stripIcc' },
        { type: 'animated' }
      ],
      ...overrides
    };
  }

  static createWatermarkPolicy(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: 'Watermark Policy',
      description: 'Policy with watermark transformation',
      transformations: [
        { 
          type: 'watermark', 
          config: { 
            sourceUrl: 'https://example.com/watermark.png',
            positionX: 10,
            positionY: 10,
            opacity: 0.8,
            widthRatio: 0.2,
            heightRatio: 0.2
          } 
        }
      ],
      ...overrides
    };
  }

  static createWatermarkPolicyWithoutOpacityWidthRatio(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: 'Watermark Policy No Opacity And Width',
      description: 'Policy with watermark transformation',
      transformations: [
        { 
          type: 'watermark', 
          config: { 
            sourceUrl: 'https://example.com/watermark.png',
            positionX: 10,
            positionY: 10,
            heightRatio: 0.2
          } 
        }
      ],
      ...overrides
    };
  }

  static createWatermarkWithResizePolicy(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: 'Watermark Resize Policy',
      description: 'Policy with watermark and resize transformations',
      transformations: [
        { type: 'resize', config: { width: 1200, height: 800 } },
        { 
          type: 'watermark', 
          config: { 
            sourceUrl: 'https://example.com/logo.png',
            positionX: 20,
            positionY: 20,
            opacity: 0.5,
            widthRatio: 0.15
          } 
        }
      ],
      ...overrides
    };
  }

}