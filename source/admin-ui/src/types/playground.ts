// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface PlaygroundHeader {
  id: string;
  key: string;
  value: string;
}

export interface PlaygroundQueryParam {
  id: string;
  key: string;
  value: string;
}

export interface ServerMetrics {
  requestId?: string;
  originFetchMs?: number;
  transformMs?: number;
  totalMs?: number;
  preOptimization?: { width: number | null; height: number | null; size: number; format: string };
  postOptimization?: { width: number; height: number; size: number; format: string };
  compressionRatio?: number | null;
}

declare global {
  interface Window {
    __imageProcessingDomain?: string;
  }
}
