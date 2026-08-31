// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import request from 'supertest';
import app, { getClientErrorStatus } from './app';

/**
 * Regression coverage for the global error handler's client-error path (CWE-248:
 * uncaught exception). Express and body-parser raise these errors before any route runs,
 * so they are only reachable through the terminal handler in app.ts and cannot be
 * exercised by the route-level tests in routes/image.test.ts.
 */
describe('app global error handler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  describe('malformed percent-encoding in the request path', () => {
    // Express decodes path params before routing, so these throw a URIError out of
    // decodeURIComponent with status 400 already attached.
    it.each(['/%c0%ae', '/%ff', '/%e0%80%ae', '/images/%c0%ae%c0%ae/etc/passwd'])(
      'Should return 400 for %s',
      async path => {
        const response = await request(app).get(path);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('BAD_REQUEST');
      }
    );

    it('Should not leak the underlying error message outside development', async () => {
      const response = await request(app).get('/%c0%ae');

      expect(response.body.message).toBe('Malformed request');
      expect(response.body.message).not.toContain('%c0%ae');
    });

    it('Should log a client error as a warning, not an error', async () => {
      await request(app).get('/%c0%ae');

      expect(console.warn).toHaveBeenCalledWith('Client error:', 400, expect.any(String));
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('body-parser client errors', () => {
    it('Should return 400 for an unparseable JSON body', async () => {
      const response = await request(app).post('/').type('json').send('{bad');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('Should return 413 for a payload over the 10mb limit', async () => {
      const response = await request(app)
        .post('/')
        .type('json')
        .send(JSON.stringify({ payload: 'x'.repeat(11 * 1024 * 1024) }));

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('getClientErrorStatus', () => {
    const withStatus = (props: Record<string, unknown>) => Object.assign(new Error('boom'), props);

    it('Should not claim a plain Error as a client error', () => {
      expect(getClientErrorStatus(new Error('boom'))).toBeUndefined();
    });

    it.each([500, 502, 503])('Should not claim a %s status as a client error', status => {
      expect(getClientErrorStatus(withStatus({ status }))).toBeUndefined();
    });

    it('Should ignore a non-numeric status', () => {
      expect(getClientErrorStatus(withStatus({ status: '400' }))).toBeUndefined();
    });

    it('Should fall back to statusCode when status is absent', () => {
      expect(getClientErrorStatus(withStatus({ statusCode: 415 }))).toBe(415);
    });

    it('Should default a bare URIError with no attached status to 400', () => {
      expect(getClientErrorStatus(new URIError('malformed'))).toBe(400);
    });
  });

  it('Should route a valid path rather than rejecting it as a client error', async () => {
    const response = await request(app).get('/valid/path.jpg');

    // Reaches the image route, which answers with its own {error, message, requestId}
    // shape. The assertion is that the global handler did not intercept it.
    expect(response.body).toHaveProperty('requestId');
    expect(response.body).not.toHaveProperty('timestamp');
  });
});
