// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ErrorMapper } from './error-mapping';
import { ImageProcessingError } from '../types';

describe('ErrorMapper', () => {
  describe('mapError', () => {
    it('should pass through ImageProcessingError unchanged', () => {
      const error = new ImageProcessingError(403, 'AccessDenied', 'No access');
      expect(ErrorMapper.mapError(error)).toBe(error);
    });

    it('should map composite dimension error', () => {
      const error = new Error('Image to composite must have same dimensions or smaller');
      const result = ErrorMapper.mapError(error);
      expect(result.statusCode).toBe(400);
      expect(result.errorType).toBe('BadRequest');
      expect(result.message).toContain('overlay');
    });

    it('should map AVIF bitstream error', () => {
      const error = new Error('Bitstream not supported by this decoder');
      const result = ErrorMapper.mapError(error);
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('AVIF');
    });

    it('should map BoundingBox property error', () => {
      const error = new Error("Cannot read property 'BoundingBox' of undefined");
      const result = ErrorMapper.mapError(error);
      expect(result.statusCode).toBe(400);
      expect(result.errorType).toBe('SmartCrop::FaceIndexOutOfRange');
    });

    it('should map BoundingBox properties error', () => {
      const error = new Error("Cannot read properties of undefined (reading 'BoundingBox')");
      const result = ErrorMapper.mapError(error);
      expect(result.statusCode).toBe(400);
      expect(result.errorType).toBe('SmartCrop::FaceIndexOutOfRange');
    });

    it('should map Sharp pixel-limit error to a 400', () => {
      const error = new Error('Input image exceeds pixel limit');
      const result = ErrorMapper.mapError(error);
      expect(result.statusCode).toBe(400);
      expect(result.errorType).toBe('BadRequest');
      expect(result.message).toContain('too large');
    });

    it('should wrap unknown errors as ProcessingFailure', () => {
      const error = new Error('Some unknown error');
      const result = ErrorMapper.mapError(error);
      expect(result.statusCode).toBe(500);
      expect(result.errorType).toBe('ProcessingFailure');
    });
  });

  describe('factory methods', () => {
    it('should create validation error', () => {
      const result = ErrorMapper.createValidationError('Invalid input');
      expect(result.statusCode).toBe(400);
      expect(result.errorType).toBe('ValidationError');
    });

    it('should create not found error', () => {
      const result = ErrorMapper.createNotFoundError('Image');
      expect(result.statusCode).toBe(404);
      expect(result.message).toBe('Image not found');
    });

    it('should create access denied error', () => {
      const result = ErrorMapper.createAccessDeniedError('bucket');
      expect(result.statusCode).toBe(403);
    });

    it('should create timeout error', () => {
      const result = ErrorMapper.createTimeoutError();
      expect(result.statusCode).toBe(408);
    });

    it('should create internal error with message', () => {
      const result = ErrorMapper.createInternalError('Custom message');
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Custom message');
    });

    it('should create internal error with default message', () => {
      const result = ErrorMapper.createInternalError();
      expect(result.message).toBe('Internal server error');
    });
  });
});
