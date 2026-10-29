// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionManager } from './connection-manager';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ImageProcessingRequest } from '../../../types/image-processing-request';
import { UrlValidator } from '../../../utils/url-validator';
import { S3UrlHelper } from '../../../utils/s3-url-helper';

jest.mock('@aws-sdk/client-s3');
jest.mock('../../../utils/get-options', () => ({ getOptions: () => ({}) }));
jest.mock('../../../utils/url-validator');
jest.mock('../../../utils/s3-url-helper');

const mockFetch = jest.fn();
global.fetch = mockFetch;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) as ArrayBuffer;
}

// Chunked delivery lets tests cross the limit mid-read; the cancel spies show a rejected response was released.
function webBody(bytes: Buffer, chunkSize = bytes.length || 1) {
  return {
    getReader: jest.fn(() => {
      let offset = 0;
      return {
        read: jest.fn(async () => {
          if (offset >= bytes.length) return { done: true, value: undefined };
          const value = new Uint8Array(bytes.subarray(offset, offset + chunkSize));
          offset += chunkSize;
          return { done: false, value };
        }),
        cancel: jest.fn().mockResolvedValue(undefined),
        releaseLock: jest.fn(),
      };
    }),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
}

function httpResponse(contentType: string | null, bytes: Buffer = JPEG, status = 200, extraHeaders: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ ...(contentType ? { 'content-type': contentType } : {}), ...extraHeaders }),
    arrayBuffer: jest.fn().mockResolvedValue(toArrayBuffer(bytes)),
    body: webBody(bytes),
  };
}

// Chunked delivery lets tests cross the limit mid-read; the destroy spy shows a rejected S3 stream was released.
function s3Body(bytes: Buffer, chunkSize = bytes.length || 1) {
  return {
    transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(bytes)),
    destroy: jest.fn(),
    [Symbol.asyncIterator]: jest.fn(async function* () {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        yield new Uint8Array(bytes.subarray(offset, offset + chunkSize));
      }
    }),
  };
}

function jpegOfLength(length: number): Buffer {
  const buf = Buffer.alloc(length);
  JPEG.copy(buf, 0, 0, Math.min(JPEG.length, length));
  return buf;
}

function abortError(): Error {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

const HTTP_URL = 'https://example.com/image.jpg';
const S3_URL = 'https://bucket.s3.amazonaws.com/key.jpg';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let imageRequest: ImageProcessingRequest;
  let mockS3Send: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Send = jest.fn();
    (S3Client as jest.Mock).mockImplementation(() => ({ send: mockS3Send }));
    (UrlValidator.validate as jest.Mock).mockImplementation(() => {});
    (S3UrlHelper.isS3Url as jest.Mock).mockReturnValue(false);
    connectionManager = new ConnectionManager();
    imageRequest = { requestId: 'req-1' } as ImageProcessingRequest;
  });

  describe('URL validation', () => {
    it('rejects an unsupported protocol with UNSUPPORTED_PROTOCOL', async () => {
      (UrlValidator.validate as jest.Mock).mockImplementation(() => { throw new Error('Unsupported protocol'); });

      await expect(connectionManager.fetchOriginImage('ftp://example.com/image.jpg', imageRequest))
        .rejects.toMatchObject({ title: 'URL validation failed', errorType: 'UNSUPPORTED_PROTOCOL', statusCode: 400 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects other URL errors with INVALID_URL', async () => {
      (UrlValidator.validate as jest.Mock).mockImplementation(() => { throw new Error('Invalid URL format'); });

      await expect(connectionManager.fetchOriginImage('not-a-url', imageRequest))
        .rejects.toMatchObject({ title: 'URL validation failed', errorType: 'INVALID_URL', statusCode: 400 });
    });
  });

  describe('HTTP origin', () => {
    it('makes exactly one GET with redirects disabled, the DIT user agent, and the configured origin headers', async () => {
      mockFetch.mockResolvedValue(httpResponse('image/jpeg'));

      await connectionManager.fetchOriginImage(HTTP_URL, imageRequest, { 'x-origin-key': 'secret' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(HTTP_URL, {
        method: 'GET',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: { 'User-Agent': 'DIT-v8-ImageProcessor/1.0', 'x-origin-key': 'secret' },
      });
    });

    it('sends no viewer headers when the origin has no configured headers', async () => {
      mockFetch.mockResolvedValue(httpResponse('image/jpeg'));

      await connectionManager.fetchOriginImage(HTTP_URL, imageRequest);

      expect(mockFetch.mock.calls[0][1].headers).toEqual({ 'User-Agent': 'DIT-v8-ImageProcessor/1.0' });
    });

    it('attaches the buffer, raw content type, format and fetch duration', async () => {
      mockFetch.mockResolvedValue(httpResponse('image/png; charset=utf-8', PNG));

      await connectionManager.fetchOriginImage('https://example.com/image.png', imageRequest);

      expect(imageRequest.sourceImageContentType).toBe('image/png; charset=utf-8');
      expect(imageRequest.sourceImage?.buffer.equals(PNG)).toBe(true);
      expect(imageRequest.sourceImage?.contentType).toBe('image/png; charset=utf-8');
      expect(imageRequest.sourceImage?.format).toBe('png');
      expect(imageRequest.sourceImage?.fetchDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('emits exactly one image_fetched event with the metric fields', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockFetch.mockResolvedValue(httpResponse('image/jpeg'));

      await connectionManager.fetchOriginImage('https://example.com/image.jpg?sig=abc', imageRequest);

      const events = logSpy.mock.calls
        .map(([line]) => { try { return JSON.parse(line); } catch { return null; } })
        .filter((e) => e?.operation === 'image_fetched');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        requestId: 'req-1',
        component: 'OriginFetcher',
        originType: 'http',
        url: 'https://example.com/image.jpg',
        contentType: 'image/jpeg',
        sizeBytes: JPEG.length,
        fetchDurationMs: expect.any(Number),
      });
      logSpy.mockRestore();
    });
  });

  describe('HTTP status and network errors keep the preflight contract', () => {
    it.each([
      [404, 'RESOURCE_NOT_FOUND', 404],
      [401, 'ACCESS_DENIED', 401],
      [403, 'ACCESS_DENIED', 403],
      [500, 'BAD_GATEWAY', 502],
      [503, 'BAD_GATEWAY', 502],
      [304, 'BAD_GATEWAY', 502],
      [429, 'BAD_GATEWAY', 502],
    ])('maps origin %i to %s (%i) without reading the body', async (status, errorType, statusCode) => {
      const response = httpResponse('text/html', JPEG, status);
      mockFetch.mockResolvedValue(response);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject({ errorType, statusCode });
      expect(response.arrayBuffer).not.toHaveBeenCalled();
      expect(response.body.getReader).not.toHaveBeenCalled();
      expect(response.body.cancel).toHaveBeenCalled();
    });

    it('maps ENOTFOUND to HOST_NOT_FOUND', async () => {
      const error = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
      mockFetch.mockRejectedValue(error);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'HOST_NOT_FOUND', statusCode: 404 });
    });

    it('maps TLS certificate errors to ACCESS_DENIED', async () => {
      const error = Object.assign(new Error('certificate error'), { cause: { code: 'CERT_HAS_EXPIRED' } });
      mockFetch.mockRejectedValue(error);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'ACCESS_DENIED', statusCode: 403 });
    });

    it('maps a blocked redirect and other fetch errors to BAD_GATEWAY', async () => {
      const redirect = Object.assign(new TypeError('fetch failed'), { cause: { message: 'unexpected redirect' } });
      mockFetch.mockRejectedValueOnce(redirect).mockRejectedValueOnce(new Error('Unknown error'));

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'BAD_GATEWAY', statusCode: 502 });
      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'BAD_GATEWAY', statusCode: 502 });
    });
  });

  describe('HTTP timeouts', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('waits past 5s for response headers and maps no headers by 30s to RequestTimeout (504)', async () => {
      let signal: AbortSignal | undefined;
      mockFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        signal = init.signal;
        init.signal.addEventListener('abort', () => reject(abortError()));
      }));

      const pending = connectionManager.fetchOriginImage(HTTP_URL, imageRequest);
      const assertion = expect(pending).rejects.toMatchObject({ errorType: 'RequestTimeout', statusCode: 504 });
      await jest.advanceTimersByTimeAsync(6000);
      expect(signal!.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(24000);
      await assertion;
    });

    it('returns the image when the origin takes longer than 5s to send headers', async () => {
      mockFetch.mockImplementation((_url, init) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(httpResponse('image/jpeg')), 8000);
        init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(abortError()); });
      }));

      const pending = connectionManager.fetchOriginImage(HTTP_URL, imageRequest);
      await jest.advanceTimersByTimeAsync(8000);
      await pending;

      expect(imageRequest.sourceImage?.buffer.equals(JPEG)).toBe(true);
    });

    it('lets the body read run past 5s and maps a body not done by 30s to RequestTimeout (504)', async () => {
      let signal: AbortSignal | undefined;
      const response = httpResponse('image/jpeg');
      response.body.getReader.mockImplementation(() => ({
        read: jest.fn(() => new Promise((_resolve, reject) => {
          signal!.addEventListener('abort', () => reject(abortError()));
        })),
        cancel: jest.fn().mockResolvedValue(undefined),
        releaseLock: jest.fn(),
      }) as any);
      mockFetch.mockImplementation(async (_url, init) => { signal = init.signal; return response; });

      const pending = connectionManager.fetchOriginImage(HTTP_URL, imageRequest);
      const assertion = expect(pending).rejects.toMatchObject({ errorType: 'RequestTimeout', statusCode: 504 });
      await jest.advanceTimersByTimeAsync(6000);
      expect(signal!.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(24000);
      await assertion;
    });

    it('clears both timers on success', async () => {
      mockFetch.mockResolvedValue(httpResponse('image/jpeg'));

      await connectionManager.fetchOriginImage(HTTP_URL, imageRequest);

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('content checks', () => {
    it.each([
      ['text/html', 'text/html'],
      [null, 'undefined'],
    ])('rejects non-image content type %p with INVALID_FORMAT (400)', async (contentType, loggedType) => {
      const response = httpResponse(contentType);
      mockFetch.mockResolvedValue(response);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject({
        title: 'Invalid content type',
        errorType: 'INVALID_FORMAT',
        statusCode: 400,
        verboseDescription: `Origin '${HTTP_URL}' does not serve image content. Content-Type: ${loggedType}`
      });
      expect(response.arrayBuffer).not.toHaveBeenCalled();
      expect(response.body.getReader).not.toHaveBeenCalled();
    });

    it('puts the origin URL without userinfo or query string in the error description', async () => {
      mockFetch.mockResolvedValue(httpResponse('text/html'));

      await expect(connectionManager.fetchOriginImage('https://user:pw@example.com/image.jpg?token=abc', imageRequest))
        .rejects.toMatchObject({
          verboseDescription: "Origin 'https://example.com/image.jpg' does not serve image content. Content-Type: text/html"
        });
    });

    it('rejects an image/* type outside the allowlist with InvalidContentType (415) without reading the body', async () => {
      const response = httpResponse('image/bmp');
      mockFetch.mockResolvedValue(response);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'InvalidContentType', statusCode: 415 });
      expect(response.arrayBuffer).not.toHaveBeenCalled();
      expect(response.body.getReader).not.toHaveBeenCalled();
      expect(response.body.cancel).toHaveBeenCalled();
    });

    it('puts the origin URL without userinfo or query string in the unsupported image type error', async () => {
      mockFetch.mockResolvedValue(httpResponse('image/bmp'));

      await expect(connectionManager.fetchOriginImage('https://user:pw@example.com/image.jpg?token=abc', imageRequest))
        .rejects.toMatchObject({
          errorType: 'InvalidContentType',
          statusCode: 415,
          verboseDescription: "Origin 'https://example.com/image.jpg' returned unsupported Content-Type 'image/bmp'."
        });
    });

    it('rejects bytes that do not match the declared type with InvalidImage (415)', async () => {
      mockFetch.mockResolvedValue(httpResponse('image/png', JPEG));

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'InvalidImage', statusCode: 415 });
      expect(imageRequest.sourceImage).toBeUndefined();
    });
  });

  describe('S3 origin', () => {
    beforeEach(() => {
      (S3UrlHelper.isS3Url as jest.Mock).mockReturnValue(true);
      (S3UrlHelper.parseS3Url as jest.Mock).mockReturnValue({ bucket: 'bucket', key: 'key.jpg' });
    });

    const s3Object = (contentType: string | undefined, bytes: Buffer = JPEG) => ({
      ContentType: contentType,
      Body: s3Body(bytes),
    });

    it('makes exactly one GetObject and attaches the image', async () => {
      mockS3Send.mockResolvedValue(s3Object('image/jpeg'));

      await connectionManager.fetchOriginImage(S3_URL, imageRequest);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'bucket', Key: 'key.jpg' });
      expect(imageRequest.sourceImageContentType).toBe('image/jpeg');
      expect(imageRequest.sourceImage?.buffer.equals(JPEG)).toBe(true);
      expect(imageRequest.sourceImage?.format).toBe('jpeg');
    });

    it('uses a client that follows region redirects', () => {
      expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({ followRegionRedirects: true }));
    });

    it('maps x-amz-* and if-* configured origin headers onto the command, ignoring others', async () => {
      (S3UrlHelper.mapHeaderToS3Property as jest.Mock).mockImplementation((h) => (h === 'x-amz-request-payer' ? 'RequestPayer' : 'IfMatch'));
      mockS3Send.mockResolvedValue(s3Object('image/jpeg'));

      await connectionManager.fetchOriginImage(S3_URL, imageRequest, {
        'x-amz-request-payer': 'requester',
        'If-Match': 'etag123',
        'user-agent': 'ignored',
      });

      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'bucket', Key: 'key.jpg', RequestPayer: 'requester', IfMatch: 'etag123' });
    });

    it('rejects an invalid S3 URL with INVALID_URL', async () => {
      (S3UrlHelper.parseS3Url as jest.Mock).mockImplementation(() => { throw new Error('Invalid S3 URL format'); });

      await expect(connectionManager.fetchOriginImage(S3_URL, imageRequest))
        .rejects.toMatchObject({ title: 'Invalid S3 URL format', errorType: 'INVALID_URL', statusCode: 400 });
    });

    it.each([
      [{ $metadata: { httpStatusCode: 404 } }, 'RESOURCE_NOT_FOUND', 404],
      [{ $metadata: { httpStatusCode: 403 } }, 'ACCESS_DENIED', 403],
      [new Error('Unknown S3 error'), 'BAD_GATEWAY', 502],
    ])('maps S3 error %p to %s (%i)', async (error, errorType, statusCode) => {
      mockS3Send.mockRejectedValue(error);

      await expect(connectionManager.fetchOriginImage(S3_URL, imageRequest)).rejects.toMatchObject({ errorType, statusCode });
    });

    it.each([
      [undefined],
      ['binary/octet-stream'],
    ])('rejects content type %p with INVALID_FORMAT (400) and releases the unread body', async (contentType) => {
      const object = s3Object(contentType);
      mockS3Send.mockResolvedValue(object);

      await expect(connectionManager.fetchOriginImage(S3_URL, imageRequest)).rejects.toMatchObject({
        title: 'Invalid content type',
        errorType: 'INVALID_FORMAT',
        statusCode: 400,
        verboseDescription: `Origin '${S3_URL}' does not serve image content. Content-Type: ${contentType}`
      });
      expect(object.Body.transformToByteArray).not.toHaveBeenCalled();
      expect(object.Body[Symbol.asyncIterator]).not.toHaveBeenCalled();
      expect(object.Body.destroy).toHaveBeenCalled();
    });

    it('does not destroy the body after reading it', async () => {
      const object = s3Object('image/jpeg');
      mockS3Send.mockResolvedValue(object);

      await connectionManager.fetchOriginImage(S3_URL, imageRequest);

      expect(object.Body.destroy).not.toHaveBeenCalled();
    });

    it('rejects an image/* type outside the allowlist with InvalidContentType (415) without reading the body', async () => {
      const object = s3Object('image/bmp');
      mockS3Send.mockResolvedValue(object);

      await expect(connectionManager.fetchOriginImage(S3_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'InvalidContentType', statusCode: 415 });
      expect(object.Body.transformToByteArray).not.toHaveBeenCalled();
      expect(object.Body[Symbol.asyncIterator]).not.toHaveBeenCalled();
      expect(object.Body.destroy).toHaveBeenCalled();
    });

    it('puts the S3 URL without its query string in the unsupported image type error', async () => {
      mockS3Send.mockResolvedValue(s3Object('image/bmp'));

      await expect(connectionManager.fetchOriginImage(`${S3_URL}?X-Amz-Signature=abc`, imageRequest))
        .rejects.toMatchObject({
          errorType: 'InvalidContentType',
          statusCode: 415,
          verboseDescription: `S3 origin '${S3_URL}' returned unsupported Content-Type 'image/bmp'.`
        });
    });

    it('rejects an empty body with ImageNotFound (404)', async () => {
      mockS3Send.mockResolvedValue({ ContentType: 'image/jpeg', Body: undefined });

      await expect(connectionManager.fetchOriginImage(S3_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'ImageNotFound', statusCode: 404 });
    });

    it('emits image_fetched with originType s3', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockS3Send.mockResolvedValue(s3Object('image/jpeg'));

      await connectionManager.fetchOriginImage(S3_URL, imageRequest);

      const events = logSpy.mock.calls
        .map(([line]) => { try { return JSON.parse(line); } catch { return null; } })
        .filter((e) => e?.operation === 'image_fetched');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ originType: 's3', sizeBytes: JPEG.length });
      logSpy.mockRestore();
    });
  });
  describe('origin body size limit', () => {
    const LIMIT = 10;
    const TOO_LARGE = { statusCode: 502, errorType: 'OriginImageTooLarge' };
    let limited: ConnectionManager;

    beforeEach(() => {
      limited = new ConnectionManager(undefined, LIMIT);
    });

    it('accepts a small body with the default limit', async () => {
      const body = jpegOfLength(64);
      mockFetch.mockResolvedValue(httpResponse('image/jpeg', body));

      await new ConnectionManager().fetchOriginImage(HTTP_URL, imageRequest);

      expect(imageRequest.sourceImage?.buffer.length).toBe(64);
    });

    describe('HTTP', () => {
      it.each([
        ['under the limit', 4],
        ['exactly the limit', LIMIT],
      ])('rejects a declared length over the limit before reading a body %s', async (_label, actual) => {
        const response = httpResponse('image/jpeg', jpegOfLength(actual), 200, { 'content-length': String(LIMIT * 2) });
        mockFetch.mockResolvedValue(response);

        await expect(limited.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject(TOO_LARGE);
        expect(response.body.getReader).not.toHaveBeenCalled();
        expect(response.body.cancel).toHaveBeenCalled();
      });

      it('rejects a declared length over the limit with 502, not 500, when the body is shorter', async () => {
        const response = httpResponse('image/jpeg', jpegOfLength(10), 200, { 'content-length': '20' });
        mockFetch.mockResolvedValue(response);

        await expect(limited.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject(TOO_LARGE);
      });

      it('returns a body whose declared and actual length equal the limit', async () => {
        const body = jpegOfLength(LIMIT);
        mockFetch.mockResolvedValue(httpResponse('image/jpeg', body, 200, { 'content-length': String(LIMIT) }));

        await limited.fetchOriginImage(HTTP_URL, imageRequest);

        expect(imageRequest.sourceImage?.buffer.equals(body)).toBe(true);
      });

      it.each([
        ['understated', { 'content-length': '5' }],
        ['equal to the limit but understated', { 'content-length': String(LIMIT) }],
        ['absent', {}],
        ['not an integer', { 'content-length': 'abc' }],
      ])('cancels the read once the body passes the limit when the declared length is %s', async (_label, headers) => {
        const response = httpResponse('image/jpeg', jpegOfLength(LIMIT + 5), 200, headers);
        response.body = webBody(jpegOfLength(LIMIT + 5), 4);
        mockFetch.mockResolvedValue(response);

        await expect(limited.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject(TOO_LARGE);
        const reader = response.body.getReader.mock.results[0].value;
        expect(reader.cancel).toHaveBeenCalled();
        // 4-byte chunks pass the 10-byte limit on the third read; the fourth chunk is never read.
        expect(reader.read).toHaveBeenCalledTimes(3);
      });

      it.each(['1.5', '-1', 'abc'])('ignores an unusable declared length %p for a body under the limit', async (declared) => {
        const body = jpegOfLength(8);
        mockFetch.mockResolvedValue(httpResponse('image/jpeg', body, 200, { 'content-length': declared }));

        await limited.fetchOriginImage(HTTP_URL, imageRequest);

        expect(imageRequest.sourceImage?.buffer.equals(body)).toBe(true);
      });

      it('returns the same bytes for a chunked body under the limit', async () => {
        const body = jpegOfLength(9);
        const response = httpResponse('image/jpeg', body);
        response.body = webBody(body, 2);
        mockFetch.mockResolvedValue(response);

        await limited.fetchOriginImage(HTTP_URL, imageRequest);

        expect(imageRequest.sourceImage?.buffer.equals(body)).toBe(true);
      });

      it('treats a missing body as empty, which the short-body check rejects with 415', async () => {
        const response: any = httpResponse('image/jpeg');
        response.body = null;
        mockFetch.mockResolvedValue(response);

        await expect(limited.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject({ errorType: 'InvalidImage', statusCode: 415 });
      });

      it('maps any other read error to FetchError (500)', async () => {
        const response = httpResponse('image/jpeg');
        response.body.getReader.mockImplementation(() => ({
          read: jest.fn().mockRejectedValue(new Error('socket hang up')),
          cancel: jest.fn().mockResolvedValue(undefined),
        }) as any);
        mockFetch.mockResolvedValue(response);

        await expect(limited.fetchOriginImage(HTTP_URL, imageRequest)).rejects.toMatchObject({ errorType: 'FetchError', statusCode: 500 });
      });
    });

    describe('S3', () => {
      beforeEach(() => {
        (S3UrlHelper.isS3Url as jest.Mock).mockReturnValue(true);
        (S3UrlHelper.parseS3Url as jest.Mock).mockReturnValue({ bucket: 'bucket', key: 'key.jpg' });
      });

      it('rejects a declared ContentLength over the limit and releases the unread body', async () => {
        const object = { ContentType: 'image/jpeg', ContentLength: LIMIT * 2, Body: s3Body(jpegOfLength(4)) };
        mockS3Send.mockResolvedValue(object);

        await expect(limited.fetchOriginImage(S3_URL, imageRequest)).rejects.toMatchObject(TOO_LARGE);
        expect(object.Body[Symbol.asyncIterator]).not.toHaveBeenCalled();
        expect(object.Body.destroy).toHaveBeenCalled();
      });

      it('returns a body whose ContentLength and actual length equal the limit', async () => {
        const body = jpegOfLength(LIMIT);
        mockS3Send.mockResolvedValue({ ContentType: 'image/jpeg', ContentLength: LIMIT, Body: s3Body(body) });

        await limited.fetchOriginImage(S3_URL, imageRequest);

        expect(imageRequest.sourceImage?.buffer.equals(body)).toBe(true);
      });

      it.each([
        ['understated', 5],
        ['absent', undefined],
      ])('destroys the stream once the body passes the limit when ContentLength is %s', async (_label, contentLength) => {
        const object = { ContentType: 'image/jpeg', ContentLength: contentLength, Body: s3Body(jpegOfLength(LIMIT + 5), 4) };
        mockS3Send.mockResolvedValue(object);

        await expect(limited.fetchOriginImage(S3_URL, imageRequest)).rejects.toMatchObject(TOO_LARGE);
        expect(object.Body.destroy).toHaveBeenCalled();
      });

      it('returns the same bytes for a chunked body under the limit', async () => {
        const body = jpegOfLength(9);
        mockS3Send.mockResolvedValue({ ContentType: 'image/jpeg', Body: s3Body(body, 2) });

        await limited.fetchOriginImage(S3_URL, imageRequest);

        expect(imageRequest.sourceImage?.buffer.equals(body)).toBe(true);
      });

      it('rejects a Buffer body over the limit and returns one at the limit', async () => {
        mockS3Send.mockResolvedValueOnce({ ContentType: 'image/jpeg', Body: jpegOfLength(LIMIT + 1) });
        await expect(limited.fetchOriginImage(S3_URL, imageRequest)).rejects.toMatchObject(TOO_LARGE);

        const body = jpegOfLength(LIMIT);
        mockS3Send.mockResolvedValueOnce({ ContentType: 'image/jpeg', Body: body });
        await limited.fetchOriginImage(S3_URL, imageRequest);
        expect(imageRequest.sourceImage?.buffer.equals(body)).toBe(true);
      });

      it('maps any other read error to FetchError (500)', async () => {
        const body = s3Body(JPEG);
        body[Symbol.asyncIterator].mockImplementation(async function* () { throw new Error('socket hang up'); });
        mockS3Send.mockResolvedValue({ ContentType: 'image/jpeg', Body: body });

        await expect(limited.fetchOriginImage(S3_URL, imageRequest)).rejects.toMatchObject({ errorType: 'FetchError', statusCode: 500 });
      });
    });
  });
});
