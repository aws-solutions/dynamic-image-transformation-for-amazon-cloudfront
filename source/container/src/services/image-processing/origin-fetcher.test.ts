// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginFetcher } from './origin-fetcher';
import { ImageProcessingError } from './types';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

const s3Mock = mockClient(S3Client);

describe('OriginFetcher', () => {
  let fetcher: OriginFetcher;

  beforeEach(() => {
    fetcher = new OriginFetcher();
    s3Mock.reset();
  });


  describe('content type validation', () => {
    it('should accept valid image content types', () => {
      expect(fetcher['isValidImageContentType']('image/jpeg')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/png')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/webp')).toBe(true);
    });

    it('should reject invalid content types', () => {
      expect(fetcher['isValidImageContentType']('text/html')).toBe(false);
      expect(fetcher['isValidImageContentType']('application/json')).toBe(false);
    });

    it('should handle case insensitive content types', () => {
      expect(fetcher['isValidImageContentType']('IMAGE/JPEG')).toBe(true);
    });

    it('should accept an image content type with parameters', () => {
      expect(fetcher['isValidImageContentType']('image/jpeg; charset=utf-8')).toBe(true);
      expect(fetcher['isValidImageContentType']('  image/png ; foo=bar')).toBe(true);
    });

    it('should reject a non-image media type that embeds an image type in a parameter (substring bypass)', () => {
      // Guards the SSRF bypass: substring matching previously let this pass and then skip magic validation.
      expect(fetcher['isValidImageContentType']('application/json; charset=image/jpeg')).toBe(false);
      expect(fetcher['isValidImageContentType']('text/html; x=image/png')).toBe(false);
    });
  });

  describe('content type gate on HTTP fetch (SSRF hardening)', () => {
    const realFetch = global.fetch;

    afterEach(() => {
      global.fetch = realFetch;
    });

    const mockResponse = (contentType: string | null) => ({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
    });

    it('should reject a response with no Content-Type header', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(null)) as unknown as typeof fetch;

      await expect(fetcher['fetchFromHttp']('https://example.com/image.jpg')).rejects.toMatchObject({
        statusCode: 415,
        errorType: 'InvalidContentType',
      });
    });

    it('should reject a non-image Content-Type', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse('application/json')) as unknown as typeof fetch;

      await expect(fetcher['fetchFromHttp']('https://example.com/image.jpg')).rejects.toMatchObject({
        statusCode: 415,
        errorType: 'InvalidContentType',
      });
    });

    it('should accept an image Content-Type with parameters', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse('image/jpeg; charset=utf-8')) as unknown as typeof fetch;

      const result = await fetcher['fetchFromHttp']('https://example.com/image.jpg');
      expect(result.contentType).toBe('image/jpeg; charset=utf-8');
    });
  });

  describe('abort timeout covers the body read (Post 8)', () => {
    const realFetch = global.fetch;

    afterEach(() => {
      global.fetch = realFetch;
      jest.restoreAllMocks();
    });

    it('should map an AbortError thrown during the body read to a 504 RequestTimeout', async () => {
      // Simulate the timer firing mid-body: headers arrive OK, then arrayBuffer() rejects with an
      // AbortError (as fetch's body read does when the AbortController aborts during the read).
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
        arrayBuffer: async () => {
          throw abortError;
        },
      }) as unknown as typeof fetch;

      await expect(fetcher['fetchFromHttp']('https://example.com/image.jpg')).rejects.toMatchObject({
        statusCode: 504,
        errorType: 'RequestTimeout',
      });
    });

    it('should clear the abort timer on a successful fetch (no leaked handle)', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
        arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
      }) as unknown as typeof fetch;

      const result = await fetcher['fetchFromHttp']('https://example.com/image.jpg');

      expect(result.contentType).toBe('image/jpeg');
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should clear the abort timer even when the body read throws', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
        arrayBuffer: async () => {
          throw abortError;
        },
      }) as unknown as typeof fetch;

      await expect(fetcher['fetchFromHttp']('https://example.com/image.jpg')).rejects.toBeDefined();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('content type gate on S3 fetch', () => {
    // aws-sdk-client-mock: intercept the S3Client GetObjectCommand used by fetchFromS3.
    // A GetObject Body is a stream-like object exposing transformToByteArray(); mirror that here.
    const s3Body = (bytes: number[]) => ({
      transformToByteArray: async () => new Uint8Array(bytes),
    });
    const validPng = [0x89, 0x50, 0x4e, 0x47];
    const s3Url = (key: string) => `https://source-bucket.s3.us-west-2.amazonaws.com/${key}`;

    it('should reject an S3 object with a non-image Content-Type (text/html)', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: s3Body(validPng) as any, ContentType: 'text/html' });

      await expect(fetcher['fetchFromS3'](s3Url('evil.html'))).rejects.toMatchObject({
        statusCode: 415,
        errorType: 'InvalidContentType',
      });
    });

    it('should reject an S3 object with a missing Content-Type', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: s3Body(validPng) as any });

      await expect(fetcher['fetchFromS3'](s3Url('no-content-type'))).rejects.toMatchObject({
        statusCode: 415,
        errorType: 'InvalidContentType',
      });
    });

    it('should reject a non-image S3 object end-to-end via fetchImage (415)', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: s3Body(validPng) as any, ContentType: 'text/html' });

      await expect(fetcher.fetchImage(s3Url('evil.html'))).rejects.toMatchObject({
        statusCode: 415,
        errorType: 'InvalidContentType',
      });
    });

    it('should accept an S3 object with image/png Content-Type and valid PNG bytes', async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: s3Body(validPng) as any, ContentType: 'image/png' });

      const result = await fetcher.fetchImage(s3Url('valid.png'));
      expect(result.metadata.format).toBe('png');
      expect(result.metadata.size).toBe(validPng.length);
    });
  });

  describe('error handling', () => {
    it('should wrap ImageProcessingError as-is', () => {
      const error = new ImageProcessingError(400, 'TestError', 'Test message');
      const result = fetcher['handleFetchError'](error, 'https://example.com/image.jpg');
      expect(result).toBe(error);
    });

    it('should handle unknown errors', () => {
      const error = { message: 'Unknown error' };
      const result = fetcher['handleFetchError'](error, 'https://example.com/image.jpg');
      expect(result.statusCode).toBe(500);
      expect(result.errorType).toBe('FetchError');
    });
  });

  describe('redirect handling (SSRF hardening)', () => {
    const realFetch = global.fetch;

    afterEach(() => {
      global.fetch = realFetch;
    });

    it('should request the GET with redirect: error so redirects are not followed', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await fetcher['fetchFromHttp']('https://example.com/image.jpg');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        expect.objectContaining({ redirect: 'error' })
      );
    });

    it('should map a blocked redirect to a 502 RedirectNotAllowed error', async () => {
      // fetch() with redirect: 'error' rejects with a TypeError whose cause is 'unexpected redirect'.
      const redirectError = new TypeError('fetch failed');
      (redirectError as unknown as { cause: { message: string } }).cause = { message: 'unexpected redirect' };
      global.fetch = jest.fn().mockRejectedValue(redirectError) as unknown as typeof fetch;

      await expect(fetcher['fetchFromHttp']('https://example.com/image.jpg')).rejects.toMatchObject({
        statusCode: 502,
        errorType: 'RedirectNotAllowed',
      });
    });
  });

  describe('validateImageMagicNumbers', () => {
    it('should reject files under 4 bytes', () => {
      const smallBuffer = Buffer.from([0xFF, 0xD8]);
      expect(() => fetcher['validateImageMagicNumbers'](smallBuffer, undefined, 'https://example.com/test.jpg')).toThrow('Invalid image file');
    });

    it('should accept valid JPEG with magic numbers', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(() => fetcher['validateImageMagicNumbers'](jpegBuffer, undefined, 'https://example.com/test.jpg')).not.toThrow();
    });

    it('should accept valid PNG with magic numbers', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(() => fetcher['validateImageMagicNumbers'](pngBuffer, undefined, 'https://example.com/test.png')).not.toThrow();
    });

    it('should accept valid GIF with magic numbers', () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38]);
      expect(() => fetcher['validateImageMagicNumbers'](gifBuffer, undefined, 'https://example.com/test.gif')).not.toThrow();
    });

    it('should accept valid WebP with magic numbers', () => {
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]);
      expect(() => fetcher['validateImageMagicNumbers'](webpBuffer, undefined, 'https://example.com/test.webp')).not.toThrow();
    });

    it('should accept images without magic numbers', () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(() => fetcher['validateImageMagicNumbers'](unknownBuffer, undefined, 'https://example.com/test.raw')).not.toThrow();
    });

    it('should validate content-type matches detected format', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(() => fetcher['validateImageMagicNumbers'](jpegBuffer, 'image/jpeg', 'https://example.com/test.jpg')).not.toThrow();
    });

    it('should reject content-type mismatch', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(() => fetcher['validateImageMagicNumbers'](pngBuffer, 'image/jpeg', 'https://example.com/test.png'))
        .toThrow('Content-Type mismatch');
    });

    it('should allow unknown content-type with detected format', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(() => fetcher['validateImageMagicNumbers'](jpegBuffer, 'image/unknown', 'https://example.com/test.jpg')).not.toThrow();
    });

    it('should allow no content-type with detected format', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(() => fetcher['validateImageMagicNumbers'](jpegBuffer, undefined, 'https://example.com/test.jpg')).not.toThrow();
    });

    it('should reject malformed magic numbers with content-type', () => {
      const malformedPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x46]); // Should be 0x47, not 0x46
      expect(() => fetcher['validateImageMagicNumbers'](malformedPngBuffer, 'image/png', 'https://example.com/test.png'))
        .toThrow('Invalid image file');
    });

    // ISOBMFF ftyp box: [4-byte box size][ 'ftyp' ][major brand]. We only assert on the 'ftyp' box,
    // not the brand, so the specific major brand here is arbitrary.
    const ftypBuffer = (majorBrand: string) =>
      Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftyp'), Buffer.from(majorBrand)]);

    it('should accept an AVIF body with an ftyp box regardless of brand', () => {
      // Brand is not enforced — a generic major brand like mif1 must still pass.
      expect(() => fetcher['validateImageMagicNumbers'](ftypBuffer('mif1'), 'image/avif', 'https://example.com/test.avif')).not.toThrow();
    });

    it('should accept a HEIF body with an ftyp box', () => {
      expect(() => fetcher['validateImageMagicNumbers'](ftypBuffer('heic'), 'image/heif', 'https://example.com/test.heic')).not.toThrow();
    });

    it('should reject an avif/heif Content-Type whose body has no ftyp box (raw-body read guard)', () => {
      const notIsobmff = Buffer.from('{"secret":"some-internal-value-here"}'); // arbitrary non-image body
      expect(() => fetcher['validateImageMagicNumbers'](notIsobmff, 'image/avif', 'https://example.com/x'))
        .toThrow('Invalid image file');
    });

    it('should reject an avif/heif body too small to contain an ftyp box', () => {
      expect(() => fetcher['validateImageMagicNumbers'](Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74]), 'image/heif', 'https://example.com/x'))
        .toThrow('Invalid image file');
    });
  });

  describe('fetchImage', () => {
    it('should route legacy S3 URLs to S3 fetcher', async () => {
      const spy = jest.spyOn(fetcher, 'fetchFromS3' as any).mockResolvedValue({ buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
      
      await fetcher.fetchImage('https://bucket.s3.amazonaws.com/key');
      
      expect(spy).toHaveBeenCalledWith('https://bucket.s3.amazonaws.com/key', undefined);
    });

    it('should route regional S3 URLs to S3 fetcher', async () => {
      const spy = jest.spyOn(fetcher, 'fetchFromS3' as any).mockResolvedValue({ buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
      
      await fetcher.fetchImage('https://bucket.s3.us-west-2.amazonaws.com/key');
      
      expect(spy).toHaveBeenCalledWith('https://bucket.s3.us-west-2.amazonaws.com/key', undefined);
    });

    it('should route dash-style S3 URLs to S3 fetcher', async () => {
      const spy = jest.spyOn(fetcher, 'fetchFromS3' as any).mockResolvedValue({ buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
      
      await fetcher.fetchImage('https://bucket.s3-eu-central-1.amazonaws.com/key');
      
      expect(spy).toHaveBeenCalledWith('https://bucket.s3-eu-central-1.amazonaws.com/key', undefined);
    });



    it('should route path-style S3 URLs to S3 fetcher', async () => {
      const spy = jest.spyOn(fetcher, 'fetchFromS3' as any).mockResolvedValue({ buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
      
      await fetcher.fetchImage('https://s3.us-west-2.amazonaws.com/bucket/key');
      
      expect(spy).toHaveBeenCalledWith('https://s3.us-west-2.amazonaws.com/bucket/key', undefined);
    });

    it('should route HTTP URLs to HTTP fetcher', async () => {
      const spy = jest.spyOn(fetcher, 'fetchFromHttp' as any).mockResolvedValue({ buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]) });
      
      await fetcher.fetchImage('https://example.com/image.jpg');
      
      expect(spy).toHaveBeenCalledWith('https://example.com/image.jpg', undefined);
    });

    it('should reject unsupported protocols', async () => {
      await expect(fetcher.fetchImage('ftp://example.com/image.jpg'))
        .rejects.toThrow('Unsupported URL protocol');
    });

    it('should reject HTTP protocol', async () => {
      await expect(fetcher.fetchImage('http://example.com/image.jpg'))
        .rejects.toThrow('Invalid URL');
    });

    it('should still run magic-number validation when Content-Type carries parameters', async () => {
      // Bypass guard: 'image/png; charset=x' with a non-PNG body passes the gate but must NOT skip
      // magic validation. Normalizing the media type before the downstream lookup catches the mismatch.
      jest.spyOn(fetcher, 'fetchFromHttp' as any).mockResolvedValue({
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG magic, not PNG
        contentType: 'image/png; charset=x',
      });

      await expect(fetcher.fetchImage('https://example.com/image.png'))
        .rejects.toThrow('Content-Type mismatch');
    });

    it('should validate a parameterized Content-Type against a matching body', async () => {
      jest.spyOn(fetcher, 'fetchFromHttp' as any).mockResolvedValue({
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG magic
        contentType: 'image/jpeg; charset=utf-8',
      });

      const result = await fetcher.fetchImage('https://example.com/image.jpg');
      // Downstream format is derived from the normalized media type, not the raw header.
      expect(result.metadata.format).toBe('jpeg');
    });
  });
});