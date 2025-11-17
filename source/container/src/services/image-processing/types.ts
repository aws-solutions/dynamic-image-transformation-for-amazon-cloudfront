// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class ImageProcessingError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;
  public readonly originalError?: Error;

  constructor(statusCode: number, errorType: string, message: string, originalError?: Error) {
    super(message);
    this.name = 'ImageProcessingError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.originalError = originalError;
  }
}

export interface ErrorMapping {
  statusCode: number;
  errorType: string;
  message: string;
}

export interface Headers {
  [key: string]: string;
}

export interface ImageProcessingResult {
  buffer: Buffer;
  contentType: string;
  headers?: Headers;
  cacheControl?: string;
}

export interface SharpOptions {
  limitInputPixels?: number;
  sequentialRead?: boolean;
  density?: number;
  ignoreIcc?: boolean;
  animated?: boolean;
  failOnError?: boolean;
}

export interface OriginFetchConfig {
  timeout?: number;
  maxRetries?: number;
  headers?: Headers;
  followRedirects?: boolean;
}

export interface TransformationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}