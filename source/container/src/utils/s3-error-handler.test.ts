// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3ErrorHandler } from './s3-error-handler';

describe('S3ErrorHandler', () => {
  describe('mapError', () => {
    it('should map NoSuchBucket error', () => {
      const error = { name: 'NoSuchBucket' };
      const result = S3ErrorHandler.mapError(error);
      expect(result).toEqual({
        statusCode: 404,
        errorType: 'BucketNotFound',
        message: 'S3 bucket not found'
      });
    });

    it('should map NoSuchKey error', () => {
      const error = { name: 'NoSuchKey' };
      const result = S3ErrorHandler.mapError(error);
      expect(result).toEqual({
        statusCode: 404,
        errorType: 'KeyNotFound',
        message: 'S3 object not found'
      });
    });

    it('should map AccessDenied error', () => {
      const error = { name: 'AccessDenied' };
      const result = S3ErrorHandler.mapError(error);
      expect(result).toEqual({
        statusCode: 403,
        errorType: 'AccessDenied',
        message: 'Access denied to S3 resource'
      });
    });

    it('should map ENOTFOUND network error', () => {
      const error = { code: 'ENOTFOUND' };
      const result = S3ErrorHandler.mapError(error);
      expect(result).toEqual({
        statusCode: 404,
        errorType: 'NetworkError',
        message: 'Unable to connect to resource'
      });
    });

    it('should map ECONNREFUSED network error', () => {
      const error = { code: 'ECONNREFUSED' };
      const result = S3ErrorHandler.mapError(error);
      expect(result).toEqual({
        statusCode: 404,
        errorType: 'NetworkError',
        message: 'Unable to connect to resource'
      });
    });

    it('should return null for unknown errors', () => {
      const error = { name: 'UnknownError' };
      const result = S3ErrorHandler.mapError(error);
      expect(result).toBeNull();
    });
  });
});
