// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { handleError, filterClientHeaders } from './image';
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

describe('filterClientHeaders', () => {
  it('Should exclude host header', () => {
    const headers = { host: 'example.com', 'x-custom': 'value' };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ 'x-custom': 'value' });
  });

  it('Should exclude accept header', () => {
    const headers = { accept: 'image/*', 'x-custom': 'value' };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ 'x-custom': 'value' });
  });

  it('Should handle case-insensitive exclusion', () => {
    const headers = { Host: 'example.com', Accept: 'image/*', 'x-custom': 'value' };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ 'x-custom': 'value' });
  });

  it("Should exclude only DIT's own token, forwarding client authorization and cookie", () => {
    // authorization/cookie are the client's credentials for the client's own origin, and
    // customers depend on forwarding them to fetch images behind auth. Only DIT's own
    // x-dit-authorization is stripped.
    const headers = {
      authorization: 'Bearer origin-token',
      cookie: 'session=abc123',
      'X-DIT-Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.cognito-access-token',
    };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ authorization: 'Bearer origin-token', cookie: 'session=abc123' });
  });

  it('Should limit to 50 headers', () => {
    const headers: Record<string, string> = {};
    for (let i = 0; i < 60; i++) {
      headers[`header-${i}`] = `value-${i}`;
    }

    const result = filterClientHeaders(headers);

    expect(Object.keys(result).length).toBe(50);
  });

  it('Should exclude headers with values exceeding 1024 characters', () => {
    const longValue = 'x'.repeat(1025);
    const headers = { 'x-long': longValue, 'x-short': 'ok' };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ 'x-short': 'ok' });
  });

  it('Should take first element from array header values', () => {
    const headers = { 'x-multi': ['first', 'second'] };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ 'x-multi': 'first' });
  });

  it('Should return empty object for empty input', () => {
    const result = filterClientHeaders({});

    expect(result).toEqual({});
  });

  it('Should exclude headers with empty string values', () => {
    const headers = { 'x-empty': '', 'x-valid': 'value' };

    const result = filterClientHeaders(headers);

    expect(result).toEqual({ 'x-valid': 'value' });
  });
});
