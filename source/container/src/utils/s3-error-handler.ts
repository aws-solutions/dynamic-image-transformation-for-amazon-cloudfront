// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface S3ErrorResult {
  statusCode: number;
  errorType: string;
  message: string;
}

export class S3ErrorHandler {
  static mapError(error: any): S3ErrorResult | null {
    if (error.name === 'NoSuchBucket') {
      return {
        statusCode: 404,
        errorType: 'BucketNotFound',
        message: 'S3 bucket not found'
      };
    }

    if (error.name === 'NoSuchKey') {
      return {
        statusCode: 404,
        errorType: 'KeyNotFound',
        message: 'S3 object not found'
      };
    }

    if (error.name === 'AccessDenied') {
      return {
        statusCode: 403,
        errorType: 'AccessDenied',
        message: 'Access denied to S3 resource'
      };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        statusCode: 404,
        errorType: 'NetworkError',
        message: 'Unable to connect to resource'
      };
    }

    return null;
  }
}
