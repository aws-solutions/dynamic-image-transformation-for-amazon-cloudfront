// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationOption } from '../types/ui';

export const AVAILABLE_TRANSFORMATIONS: TransformationOption[] = [
  // Basic transformations
  { id: 'resize', title: 'Resize', description: 'Change image dimensions', category: 'basic' },
  { id: 'quality', title: 'Quality', description: 'Adjust image quality (1-100)', category: 'basic' },
  { id: 'format', title: 'Format', description: 'Convert image format', category: 'basic' },
  { id: 'rotate', title: 'Rotate', description: 'Rotate image by degrees', category: 'basic' },
  { id: 'flip', title: 'Flip', description: 'Flip image vertically', category: 'basic' },
  { id: 'flop', title: 'Flop', description: 'Flip image horizontally', category: 'basic' },
  
  // Effects
  { id: 'blur', title: 'Blur', description: 'Apply blur effect', category: 'effects' },
  { id: 'sharpen', title: 'Sharpen', description: 'Sharpen image details', category: 'effects' },
  { id: 'grayscale', title: 'Grayscale', description: 'Convert to grayscale', category: 'effects' },
  { id: 'tint', title: 'Tint', description: 'Apply color tint', category: 'effects' },
  { id: 'normalize', title: 'Normalize', description: 'Normalize image contrast', category: 'effects' },
  
  // Advanced
  { id: 'smartCrop', title: 'Smart Crop', description: 'Intelligent face-based cropping', category: 'advanced' },
  { id: 'extract', title: 'Extract', description: 'Extract region from image', category: 'advanced' },
  { id: 'convolve', title: 'Convolve', description: 'Apply convolution filter', category: 'advanced' },
  { id: 'flatten', title: 'Flatten', description: 'Flatten image with background color', category: 'advanced' },
  { id: 'stripExif', title: 'Strip EXIF', description: 'Remove EXIF metadata', category: 'advanced' },
  { id: 'stripIcc', title: 'Strip ICC', description: 'Remove ICC color profile', category: 'advanced' },
  { id: 'animated', title: 'Animated', description: 'Control animated image behavior', category: 'advanced' }
];