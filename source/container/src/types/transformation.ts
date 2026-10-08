// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface Transformation {
  type: string;
  value: any;
  source: 'url' | 'policy' | 'auto';
  conditional?: TransformationConditional;
  // True only for a format chosen by `format: auto` negotiation (dit-accept or auto fallback).
  // The image processor may drop it when it would lose the source's alpha channel or animation.
  negotiated?: boolean;
}

export interface TransformationConditional {
  target: string; // e.g., 'headers.dit-accept', 'headers.dit-dpr'
  operator: 'equals' | 'isIn';
  value: string | string[];
}

type OutputConfig = 
  | { type: 'quality'; value: [number, ...[number, number, number][]]; fallback?: { dpr: number } }
  | { type: 'format'; value: string; fallback?: { format: string } }
  | { type: 'autosize'; value: number[]; fallback?: { viewportWidth: number } };

export interface TransformationPolicy {
  policyId: string;
  policyName: string;
  description?: string;
  transformations: Transformation[];
  outputs?: OutputConfig[];
  isDefault: boolean;
}