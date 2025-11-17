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

  static createPolicyWithTransformationsOnly(overrides: Partial<TransformationPolicyTestData> = {}): TransformationPolicyTestData {
    return {
      name: `Transform Only Policy ${Date.now()}`,
      description: 'Policy with transformations but no output optimizations',
      transformations: [
        { type: 'quality', config: { quality: 75 } },
        { type: 'resize', config: { width: 800, height: 600, fit: 'cover' } }
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

}
