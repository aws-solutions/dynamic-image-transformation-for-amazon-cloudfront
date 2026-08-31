// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export type RekognitionApiName =
  | 'DetectFaces'
  | 'DetectLabels'
  | 'DetectText'
  | 'DetectModerationLabels'
  | 'DetectCustomLabels';

export interface NormalizedBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
  label?: string;
  confidence: number;
}

export interface DetectionResult {
  apiName: RekognitionApiName;
  boundingBoxes: NormalizedBoundingBox[];
}

export interface RekognitionClientResult {
  detection: DetectionResult;
  latencyMs: number;
}

export interface CacheGetRequest {
  apiName: RekognitionApiName;
  imageBytes: Buffer;
  customModelArn?: string;
}

export interface CacheGetResult {
  result: DetectionResult;
  source: 'cache' | 'rekognition';
  latencyMs: number;
}

export interface TargetResolutionRequest {
  imageBytes: Buffer;
  requiredApis: RekognitionApiName[];
  customModelArn?: string;
}
