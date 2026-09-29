// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class SmartCropError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;

  constructor(message: string, statusCode = 500, errorType = 'SMART_CROP_ERROR') {
    super(message);
    this.name = 'SmartCropError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

export class SmartCropValidationError extends SmartCropError {
  constructor(message: string) {
    super(message, 400, 'SMART_CROP_VALIDATION_ERROR');
    this.name = 'SmartCropValidationError';
  }
}

export class NoDetectionResultError extends SmartCropError {
  constructor(message = 'No targets detected above confidence threshold') {
    super(message, 500, 'NO_DETECTION_RESULT');
    this.name = 'NoDetectionResultError';
  }
}

export class SmartCropInternalError extends SmartCropError {
  constructor(message: string) {
    super(message, 500, 'SMART_CROP_INTERNAL_ERROR');
    this.name = 'SmartCropInternalError';
  }
}
