// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class RekognitionServiceError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;
  public readonly cause?: unknown;

  constructor(message: string, statusCode = 500, errorType = 'REKOGNITION_SERVICE_ERROR', options?: { cause?: unknown }) {
    super(message);
    if (options?.cause) this.cause = options.cause;
    this.name = 'RekognitionServiceError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

export class RekognitionApiError extends RekognitionServiceError {
  public readonly apiName: string;

  constructor(apiName: string, message: string, statusCode = 502, options?: { cause?: unknown }) {
    super(message, statusCode, 'REKOGNITION_API_ERROR', options);
    this.name = 'RekognitionApiError';
    this.apiName = apiName;
  }
}

export class CustomLabelsModelNotRunningError extends RekognitionServiceError {
  public readonly modelArn: string;

  constructor(modelArn: string) {
    super(`Custom Labels model is not running: ${modelArn}`, 502, 'CUSTOM_LABELS_MODEL_NOT_RUNNING');
    this.name = 'CustomLabelsModelNotRunningError';
    this.modelArn = modelArn;
  }
}

export class RekognitionCacheError extends RekognitionServiceError {
  public readonly operation: 'read' | 'write';

  constructor(operation: 'read' | 'write', message: string) {
    super(message, 500, 'REKOGNITION_CACHE_ERROR');
    this.name = 'RekognitionCacheError';
    this.operation = operation;
  }
}
