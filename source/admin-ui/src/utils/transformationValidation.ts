// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { transformationSchemas } from '@data-models';

// Validation function using data-models schemas
export const validateTransformationValue = (transformationType: string, value: any) => {
  const schema = transformationSchemas[transformationType as keyof typeof transformationSchemas];
  if (!schema) {
    return { success: true, data: value };
  }
  
  return schema.safeParse(value);
};

// Get validation constraints for UI
export const getValidationConstraints = (transformationType: string) => {
  switch (transformationType) {
    case 'quality':
      return { min: 1, max: 100, step: 1, type: 'integer' };
    case 'blur':
      return { min: 0.3, max: 1000, step: 0.1, type: 'decimal' };
    case 'rotate':
      return { min: -360, max: 360, step: 1, type: 'integer' };
    case 'resize':
      return { 
        width: { min: 1, max: 4000, step: 1, type: 'integer' },
        height: { min: 1, max: 4000, step: 1, type: 'integer' }
      };
    case 'extract':
      return { min: 0, max: 10000, step: 1, type: 'integer' };
    case 'convolve':
      return { kernelLength: 9, type: 'integer' };
    default:
      return {};
  }
};