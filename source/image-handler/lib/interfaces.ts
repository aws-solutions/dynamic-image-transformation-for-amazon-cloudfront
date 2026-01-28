// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp from "sharp";

import { ImageFormatTypes, RequestTypes, StatusCodes } from "./enums";
import { Headers, ImageEdits } from "./types";

export interface ImageHandlerEvent {
  path?: string;
  queryStringParameters?: {
    signature?: string;
    fmt?: "avif" | "jpeg";
  };
  requestContext?: {
    elb?: unknown;
  };
  headers?: Headers;
  _warmOrchestrator?: {
    url: string;
    acceptHeader?: string;
  };
}

export interface DefaultImageRequest {
  bucket?: string;
  key: string;
  // Support both old (use_efs) and new (efs) format
  use_efs?: boolean;
  efs?: boolean;
  // Version field for cache invalidation (old: bw_original_version, new: v)
  bw_original_version?: number;
  v?: number;
  edits?: ImageEdits;
  outputFormat?: ImageFormatTypes;
  effort?: number;
  headers?: Headers;
}

export interface BoundingBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface BoxSize {
  height: number;
  width: number;
}

export interface ImageRequestInfo {
  requestType: RequestTypes;
  bucket: string;
  key: string;
  useEfs?: boolean;
  edits?: ImageEdits;
  originalImage: Buffer;
  headers?: Headers;
  contentType?: string;
  expires?: string;
  lastModified?: string;
  cacheControl?: string;
  outputFormat?: ImageFormatTypes;
  effort?: number;
}

export interface RekognitionCompatibleImage {
  imageBuffer: {
    data: Buffer;
    info: sharp.OutputInfo;
  };
  format: keyof sharp.FormatEnum;
}

export interface ImageHandlerExecutionResult {
  statusCode: StatusCodes;
  isBase64Encoded: boolean;
  headers: Headers;
  body: string;
}
