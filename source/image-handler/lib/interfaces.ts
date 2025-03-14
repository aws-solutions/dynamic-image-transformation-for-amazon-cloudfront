// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp from "sharp";

import { ImageFormatTypes, RequestTypes, StatusCodes } from "./enums";
import { Headers, ImageEdits } from "./types";

export interface QueryStringParameters {
  signature?: string;
  expires?: string;
  format?: string;
  fit?: string;
  width?: string;
  height?: string;
  rotate?: string;
  flip?: string;
  flop?: string;
  grayscale?: string;
}

export interface ImageHandlerEvent {
  path?: string;
  queryStringParameters?: QueryStringParameters;
  requestContext?: {
    elb?: unknown;
  };
  headers?: Headers;
}

export interface S3UserRequest {
  url: string;
  headers: Headers;
}

export interface S3Event {
  userRequest: S3UserRequest;
}

export interface S3GetObjectEvent extends S3Event {
  getObjectContext: {
    outputRoute: string;
    outputToken: string;
  };
}

export interface S3HeadObjectResult {
  statusCode: number;
  headers: Headers;
}

export interface DefaultImageRequest {
  bucket?: string;
  key: string;
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
  edits?: ImageEdits;
  originalImage: Buffer;
  headers?: Headers;
  contentType?: string;
  expires?: string;
  lastModified?: string;
  cacheControl?: string;
  outputFormat?: ImageFormatTypes;
  effort?: number;
  secondsToExpiry?: number;
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
  body: Buffer | string;
}
