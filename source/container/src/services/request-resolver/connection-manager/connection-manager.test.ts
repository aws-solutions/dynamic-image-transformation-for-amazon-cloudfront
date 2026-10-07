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

function httpResponse(contentType: string | null, bytes: Buffer = JPEG, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(contentType ? { 'content-type': contentType } : {}),
    arrayBuffer: jest.fn().mockResolvedValue(toArrayBuffer(bytes)),
    body: { cancel: jest.fn().mockResolvedValue(undefined) },
  };
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
      response.arrayBuffer.mockImplementation(() => new Promise((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(abortError()));
      }));
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
      ['text/html'],
      [null],
    ])('rejects non-image content type %p with INVALID_FORMAT (400)', async (contentType) => {
      const response = httpResponse(contentType);
      mockFetch.mockResolvedValue(response);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ title: 'Invalid content type', errorType: 'INVALID_FORMAT', statusCode: 400 });
      expect(response.arrayBuffer).not.toHaveBeenCalled();
    });

    it('rejects an image/* type outside the allowlist with InvalidContentType (415) without reading the body', async () => {
      const response = httpResponse('image/bmp');
      mockFetch.mockResolvedValue(response);

      await expect(connectionManager.fetchOriginImage(HTTP_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'InvalidContentType', statusCode: 415 });
      expect(response.arrayBuffer).not.toHaveBeenCalled();
      expect(response.body.cancel).toHaveBeenCalled();
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
      Body: { transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(bytes)), destroy: jest.fn() },
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

      await expect(connectionManager.fetchOriginImage(S3_URL, imageRequest))
        .rejects.toMatchObject({ errorType: 'INVALID_FORMAT', statusCode: 400 });
      expect(object.Body.transformToByteArray).not.toHaveBeenCalled();
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
      expect(object.Body.destroy).toHaveBeenCalled();
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
});
