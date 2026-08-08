// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OriginFetcher } from './origin-fetcher';
import { ImageProcessingError } from './types';

describe('OriginFetcher', () => {
  let fetcher: OriginFetcher;

  beforeEach(() => {
    fetcher = new OriginFetcher();
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
    it('should accept ICO content types (Issue #6)', () => {
      expect(fetcher['isValidImageContentType']('image/x-icon')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/vnd.microsoft.icon')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/ico')).toBe(true);
    });
    it('should accept SVG content type (Issue #11)', () => {
      expect(fetcher['isValidImageContentType']('image/svg+xml')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/svg+xml; charset=utf-8')).toBe(true);
    });
    
    it('should accept BMP content types (Issue #13)', () => {
      expect(fetcher['isValidImageContentType']('image/bmp')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/x-bmp')).toBe(true);
      expect(fetcher['isValidImageContentType']('image/x-ms-bmp')).toBe(true);
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
  });
});