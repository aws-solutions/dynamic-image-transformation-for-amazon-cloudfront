// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface Transformation {
  type: string;
  value: any;
  source: 'url' | 'policy' | 'auto';
  conditional?: TransformationConditional;
}

export interface TransformationConditional {
  target: string; // e.g., 'headers.dit-accept', 'headers.dit-dpr'
  operator: 'equals' | 'isIn';
  value: string | string[];
}

type OutputConfig = 
  | { type: 'quality'; value: [number, ...[number, number, number][]] }
  | { type: 'format'; value: string }
  | { type: 'autosize'; value: number[] };

export interface TransformationPolicy {
  policyId: string;
  policyName: string;
  description?: string;
  transformations: Transformation[];
  outputs?: OutputConfig[];
  isDefault: boolean;
}