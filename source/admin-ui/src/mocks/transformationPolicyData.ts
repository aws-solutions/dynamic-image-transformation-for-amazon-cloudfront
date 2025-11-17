// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TransformationPolicy } from '@data-models';
import { TransformationOption } from '../types/interfaces';

// Available transformation options for the UI
export const availableTransformations: TransformationOption[] = [
  // Basic transformations
  { id: 'quality', title: 'Quality', description: 'Adjust image quality (1-100)', category: 'basic' },
  { id: 'format', title: 'Format', description: 'Convert image format (jpeg, png, webp, avif)', category: 'basic' },
  { id: 'resize', title: 'Resize', description: 'Change image dimensions with fit options', category: 'basic' },
  { id: 'rotate', title: 'Rotate', description: 'Rotate image by degrees (0-360)', category: 'basic' },
  
  // Effects
  { id: 'blur', title: 'Blur', description: 'Apply blur effect (0.3-1000)', category: 'effects' },
  { id: 'sharpen', title: 'Sharpen', description: 'Enhance image sharpness', category: 'effects' },
  { id: 'grayscale', title: 'Grayscale', description: 'Convert to grayscale', category: 'effects' },
  { id: 'normalize', title: 'Normalize', description: 'Enhance image contrast', category: 'effects' },
  { id: 'tint', title: 'Tint', description: 'Apply color tint to image', category: 'effects' },
  
  // Advanced
  { id: 'smartCrop', title: 'Smart Crop', description: 'AI-powered face detection cropping', category: 'advanced' },
  { id: 'extract', title: 'Extract', description: 'Extract a region from the image', category: 'advanced' },
  { id: 'convolve', title: 'Convolve', description: 'Apply custom convolution kernel', category: 'advanced' },
  { id: 'flatten', title: 'Flatten', description: 'Flatten alpha channel with background color', category: 'advanced' },
  { id: 'stripExif', title: 'Strip EXIF', description: 'Remove image metadata', category: 'advanced' },
  { id: 'stripIcc', title: 'Strip ICC', description: 'Remove color profile', category: 'advanced' },
  { id: 'flip', title: 'Flip', description: 'Flip image vertically', category: 'advanced' },
  { id: 'flop', title: 'Flop', description: 'Flip image horizontally', category: 'advanced' },
  { id: 'animated', title: 'Animated', description: 'Preserve animation in GIFs', category: 'advanced' }
];

// Mock transformation policies
export const mockTransformationPolicies: TransformationPolicy[] = [
  {
    policyId: '550e8400-e29b-41d4-a716-446655440001',
    policyName: 'Mobile Optimization',
    description: 'Optimized for mobile devices with quality and format conversion',
    isDefault: true,
    policyJSON: {
      transformations: [
        { 
          transformation: 'quality', 
          value: 80,
          condition: { field: 'device', value: 'mobile' }
        },
        { 
          transformation: 'format', 
          value: 'webp',
          condition: { field: 'accept', value: ['webp', 'avif'] }
        },
        { transformation: 'resize', value: { width: 800, height: 600, fit: 'cover' } }
      ],
      outputs: [
        { type: 'quality', value: [80, [1, 1.5, 0.9], [1.5, 2, 0.8], [2, 999, 0.7]] },
        { type: 'format', value: 'webp' }
      ]
    },
    createdAt: '2024-09-25T10:00:00Z',
    updatedAt: '2024-09-26T14:30:00Z'
  },
  {
    policyId: '550e8400-e29b-41d4-a716-446655440002',
    policyName: 'High Quality Print',
    description: 'Maximum quality for print materials',
    isDefault: false,
    policyJSON: {
      transformations: [
        { 
          transformation: 'quality', 
          value: 95,
          condition: { field: 'dpi', value: 300 }
        },
        { transformation: 'format', value: 'png' },
        { 
          transformation: 'sharpen', 
          value: true,
          condition: { field: 'usage', value: 'print' }
        }
      ]
    },
    createdAt: '2024-09-20T08:15:00Z'
  },
  {
    policyId: '550e8400-e29b-41d4-a716-446655440003',
    policyName: 'Thumbnail Generation',
    description: 'Small thumbnails with smart cropping',
    isDefault: false,
    policyJSON: {
      transformations: [
        { transformation: 'resize', value: { width: 150, height: 150, fit: 'cover' } },
        { 
          transformation: 'smartCrop', 
          value: true,
          condition: { field: 'faces', value: 'detected' }
        },
        { transformation: 'quality', value: 75 },
        { transformation: 'stripExif', value: true }
      ]
    },
    createdAt: '2024-09-18T16:45:00Z'
  },
  {
    policyId: '550e8400-e29b-41d4-a716-446655440004',
    policyName: 'Grayscale Effects',
    description: 'Artistic grayscale with sharpening',
    isDefault: false,
    policyJSON: {
      transformations: [
        { 
          transformation: 'grayscale', 
          value: true,
          condition: { field: 'style', value: ['artistic', 'vintage', 'monochrome'] }
        },
        { transformation: 'sharpen', value: { sigma: 1.5 } },
        { transformation: 'quality', value: 85 }
      ]
    },
    createdAt: '2024-09-15T12:20:00Z'
  },
  {
    policyId: '550e8400-e29b-41d4-a716-446655440005',
    policyName: 'Social Media Ready',
    description: 'Optimized for social media platforms',
    isDefault: false,
    policyJSON: {
      transformations: [
        { 
          transformation: 'resize', 
          value: { width: 1200, height: 630, fit: 'cover' },
          condition: { field: 'platform', value: 'facebook' }
        },
        { transformation: 'format', value: 'jpeg' },
        { 
          transformation: 'quality', 
          value: 82,
          condition: { field: 'bandwidth', value: 'low' }
        },
        { transformation: 'stripExif', value: true },
        { transformation: 'stripIcc', value: true }
      ],
      outputs: [
        { type: 'autosize', value: [320, 480, 720, 1080, 1440, 1920, 2048, 3840] },
        { type: 'quality', value: [82, [2, 999, 0.75]] }
      ]
    },
    createdAt: '2024-09-12T09:30:00Z'
  }
];