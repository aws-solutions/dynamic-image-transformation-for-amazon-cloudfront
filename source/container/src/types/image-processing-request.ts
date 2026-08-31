// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Transformation } from './transformation';

export interface SmartCropMetrics {
  detectionMethod: string;
  targetsFound: number;
  confidence: number;
  faceIndex: number;
  padding: number;
  cropCoordinates: { left: number; top: number; width: number; height: number };
}

export interface LatencyMetrics {
  originFetchMs: number;
  transformationApplicationMs: number;
  requestResolutionMs: number;
  transformationResolutionMs: number;
  totalRequestMs: number;
}

export interface TransformationMetrics {
  preOptimization: { width: number | null; height: number | null; size: number; format: string };
  postOptimization: { width: number; height: number; size: number; format: string };
  compressionRatio: number | null;
  smartCrop?: SmartCropMetrics;
  timings: LatencyMetrics;
}

export interface ImageProcessingRequest {
  // Core request metadata
  requestId: string;
  timestamp: number;
  sourceImageContentType?: string;
  
  // Client headers to forward to origin
  clientHeaders?: Record<string, string>;
  
  // Origin information (populated by RequestResolver)
  origin?: {
    url: string;
    headers?: Record<string, string>;
  };
  
  // Transformations (populated by TransformationResolver)
  transformations?: Transformation[];
  
  // Policy ID (populated by RequestResolver when a Mapping contains a policyId)
  policy?: { id: string;}
  
  // Response configuration
  response: {
    headers: Record<string, string>;
    cacheControl?: string;
    contentType?: string;
  };

  // Extended transformation metrics (populated by ImageProcessorService)
  metrics?: TransformationMetrics;

  // Timing data (populated throughout request lifecycle)
  timings?: {
    requestResolution?: {
      preflightValidationMs?: number;
    };
    transformationResolution?: {
      startMs: number;
      endMs?: number;
      durationMs?: number;
    };
    imageProcessing?: {
      originFetchMs?: number;
      transformationApplicationMs?: number;
    };
  };
}