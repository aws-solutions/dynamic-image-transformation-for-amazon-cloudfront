// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { handleError } from './image';
import { ValidationError } from '../services/request-resolver/errors/validation.error';
import { OriginNotFoundError } from '../services/request-resolver/errors/origin-not-found.error';
import { ConnectionError } from '../services/request-resolver/errors/connection.error';
import { PolicyNotFoundError } from '../services/transformation-resolver/errors/policy-not-found.error';
import { ImageProcessingError } from '../services/image-processing/types';

describe('handleError', () => {
  const requestId = 'test-request-id';
  const startTime = Date.now();

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Should return 400 for ValidationError', () => {
    const error = new ValidationError('Invalid input', 'Detailed validation message');

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(400);
    expect(result.errorType).toBe('VALIDATION_ERROR');
    expect(result.clientMessage).toBe('Invalid input');
  });

  it('Should return status from OriginNotFoundError', () => {
    const error = new OriginNotFoundError('Origin not found', 404, 'Verbose origin message');

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(404);
    expect(result.errorType).toBe('ORIGIN_NOT_FOUND');
    expect(result.clientMessage).toBe('Origin not found');
  });

  it('Should return status and errorType from ConnectionError', () => {
    const error = new ConnectionError('Connection failed', 'Verbose connection error', 503, 'UPSTREAM_ERROR');

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(503);
    expect(result.errorType).toBe('UPSTREAM_ERROR');
    expect(result.clientMessage).toBe('Connection failed');
  });

  it('Should return 404 for PolicyNotFoundError', () => {
    const error = new PolicyNotFoundError('Policy xyz not found');

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(404);
    expect(result.errorType).toBe('POLICY_NOT_FOUND');
    expect(result.clientMessage).toBe('Policy xyz not found');
  });

  it('Should return status and errorType from ImageProcessingError', () => {
    const originalError = new Error('Sharp failed');
    const error = new ImageProcessingError(422, 'PROCESSING_FAILED', 'Image processing failed', 'Verbose desc', originalError);

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(422);
    expect(result.errorType).toBe('PROCESSING_FAILED');
    expect(result.clientMessage).toBe('Image processing failed');
  });

  it('Should return 500 for generic Error', () => {
    const error = new Error('Something went wrong');

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(500);
    expect(result.errorType).toBe('INTERNAL_ERROR');
    expect(result.clientMessage).toBe('An unexpected error occurred while processing your request');
  });

  it('Should return 500 for non-Error values', () => {
    const error = 'string error';

    const result = handleError(error, requestId, startTime);

    expect(result.statusCode).toBe(500);
    expect(result.errorType).toBe('INTERNAL_ERROR');
    expect(result.clientMessage).toBe('An unexpected error occurred while processing your request');
  });
});
