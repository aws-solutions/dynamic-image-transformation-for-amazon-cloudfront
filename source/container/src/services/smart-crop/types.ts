// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RekognitionApiName } from '../rekognition/types';

export type DirectionalPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ConfigurableConstraintType = 'aspectRatio' | 'padding';

export type SatisfactionKey = 'targetInclusion' | 'aspectRatio' | 'padding' | 'gravity';

export type FallbackStrategy = 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'no-crop';

export interface PaddingValue {
  value: number;
  unit: 'px' | '%';
}

export type GravityConfig =
  | { type: 'directional'; position: DirectionalPosition }
  | { type: 'label'; labelName: string };

export interface AspectRatioConfig {
  w: number; // positive integer [1, 100]
  h: number; // positive integer [1, 100]
}

export type PaddingConfig = PaddingValue; // uniform padding applied to all four sides

export type Constraint =
  | { type: 'aspectRatio'; config: AspectRatioConfig }
  | { type: 'padding'; config: PaddingConfig };

export interface ParsedSmartCropConfig {
  faces: boolean;
  faceIndex?: number;
  labels: string[];
  customModelArn?: string;
  aspectRatio?: { w: number; h: number };
  padding: PaddingValue;
  gravity: GravityConfig;
  priorities: ConfigurableConstraintType[];
  retainText: boolean;
  retainLogo: boolean;
  fallback: FallbackStrategy;
  minConfidence: number;
}

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SolverInput {
  unionBBox: CropRegion;
  imageDimensions: { width: number; height: number };
  constraints: Constraint[];
  gravity: GravityConfig;
  targetBBoxes?: CropRegion[];
  gravityLabelBBoxes?: CropRegion[];
}

export interface SolverOutput {
  cropRegion: CropRegion;
  constraintSatisfaction: Map<SatisfactionKey, 'full' | 'partial' | 'none'>;
}

export interface SmartCropResult {
  cropRegion: CropRegion;
  constraintSatisfaction: Map<SatisfactionKey, 'full' | 'partial' | 'none'>;
  detectionMethods: RekognitionApiName[];
  targetsFound: number;
  fallbackApplied: boolean;
  fallbackReason?: string;
}
