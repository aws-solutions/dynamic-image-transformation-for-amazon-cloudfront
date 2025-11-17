// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageProcessingError } from '../types';

export class ErrorMapper {
  private static readonly ERROR_MAPPINGS = [
    {
      pattern: 'Image to composite must have same dimensions or smaller',
      statusCode: 400,
      errorType: 'BadRequest',
      messageTransform: (msg: string) => msg.replace('composite', 'overlay')
    },
    {
      pattern: 'Bitstream not supported by this decoder',
      statusCode: 400,
      errorType: 'BadRequest',
      messageTransform: () => 'Invalid base image. AVIF images with a bit-depth other than 8 are not supported for image edits.'
    },
    {
      pattern: 'Cannot read property \'BoundingBox\' of undefined',
      statusCode: 400,
      errorType: 'SmartCrop::FaceIndexOutOfRange',
      messageTransform: () => 'You have provided a FaceIndex value that exceeds the length of the zero-based detectedFaces array.'
    },
    {
      pattern: 'Cannot read properties of undefined (reading \'BoundingBox\')',
      statusCode: 400,
      errorType: 'SmartCrop::FaceIndexOutOfRange',
      messageTransform: () => 'You have provided a FaceIndex value that exceeds the length of the zero-based detectedFaces array.'
    }
  ];

  static mapError(error: any): ImageProcessingError {
    if (error instanceof ImageProcessingError) {
      return error;
    }

    for (const mapping of this.ERROR_MAPPINGS) {
      if (error.message?.includes(mapping.pattern)) {
        return new ImageProcessingError(
          mapping.statusCode,
          mapping.errorType,
          mapping.messageTransform(error.message),
          error
        );
      }
    }

    // Default error mapping
    return new ImageProcessingError(
      500,
      'ProcessingFailure',
      'Image processing failed.',
      error
    );
  }

  static createValidationError(message: string): ImageProcessingError {
    return new ImageProcessingError(400, 'ValidationError', message);
  }

  static createNotFoundError(resource: string): ImageProcessingError {
    return new ImageProcessingError(404, 'NotFound', `${resource} not found`);
  }

  static createAccessDeniedError(resource: string): ImageProcessingError {
    return new ImageProcessingError(403, 'AccessDenied', `Access denied to ${resource}`);
  }

  static createTimeoutError(): ImageProcessingError {
    return new ImageProcessingError(408, 'RequestTimeout', 'Request timeout');
  }

  static createInternalError(message?: string): ImageProcessingError {
    return new ImageProcessingError(
      500,
      'InternalError',
      message || 'Internal server error'
    );
  }
}