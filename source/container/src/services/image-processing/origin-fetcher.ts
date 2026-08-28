// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getOptions } from '../../utils/get-options';
import { ImageProcessingError } from './types';
import { S3UrlHelper } from '../../utils/s3-url-helper';
import { UrlValidator } from '../../utils/url-validator';
import { S3ErrorHandler } from '../../utils/s3-error-handler';

export class OriginFetcher {
  private s3Client: S3Client;
  private httpTimeout: number = 30000;

  constructor() {
    this.s3Client = new S3Client({
      ...getOptions(),
      followRegionRedirects: true
    });
  }

  public async fetchImage(url: string, headers?: Record<string, string>, requestId?: string): Promise<{ buffer: Buffer; metadata: { size: number; format?: string } }> {
    const startTime = Date.now();
    
    let result: { buffer: Buffer; contentType?: string };
    if (S3UrlHelper.isS3Url(url)) {
      result = await this.fetchFromS3(url, headers);
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        UrlValidator.validate(url);
      } catch (error) {
        throw new ImageProcessingError(400, 'InvalidUrl', 'Invalid URL', `URL validation failed for '${url}': ${error instanceof Error ? error.message : 'Unknown validation error'}`);
      }
      result = await this.fetchFromHttp(url, headers);
    } else {
      throw new ImageProcessingError(400, 'InvalidUrl', 'Unsupported URL protocol', `URL '${url}' uses an unsupported protocol. Only http://, https://, and s3:// are supported.`);
    }

    // Normalize once so a parameter (e.g. '; charset=...') can't dodge the downstream exact-key
    // lookups and skip magic-number validation, reopening the SSRF raw-body read (finding a3ede07f).
    const mediaType = result.contentType ? this.normalizeMediaType(result.contentType) : undefined;

    this.validateImageMagicNumbers(result.buffer, mediaType, url);
    const fetchDurationMs = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId: requestId || 'unknown',
      component: 'OriginFetcher',
      operation: 'image_fetched',
      originType: S3UrlHelper.isS3Url(url) ? 's3' : 'http',
      url: this.sanitizeUrl(url),
      contentType: mediaType,
      sizeBytes: result.buffer.length,
      fetchDurationMs
    }));

    const format = mediaType?.replace('image/', '');
    return {
      buffer: result.buffer,
      metadata: {
        size: result.buffer.length,
        format
      }
    };
  }

  private async fetchFromS3(url: string, headers?: Record<string, string>): Promise<{ buffer: Buffer; contentType?: string }> {
    // S3 enforces its own deadline via the SDK client timeout (getOptions()), not this AbortController.
    try {
      const { bucket, key } = S3UrlHelper.parseS3Url(url);
      console.log(`Attempting to fetch from bucket: ${bucket} and key: ${key}`)      
      const commandInput: any = { Bucket: bucket, Key: key };
      
      if (headers) {
        Object.entries(headers).forEach(([name, value]) => {
          const lowerName = name.toLowerCase();
          if (lowerName.startsWith('x-amz-') || lowerName.startsWith('if-')) {
            commandInput[S3UrlHelper.mapHeaderToS3Property(lowerName)] = value;
          }
        });
      }
      
      const command = new GetObjectCommand(commandInput);
      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new ImageProcessingError(404, 'ImageNotFound', 'Image not found in S3', `S3 GetObject returned empty body for '${url}'.`);
      }

      const buffer = Buffer.isBuffer(response.Body) 
        ? response.Body 
        : Buffer.from(await response.Body.transformToByteArray());

      // Fail closed on missing/non-image Content-Type, mirroring fetchFromHttp (Guardian Post 4a).
      const contentType = response.ContentType;
      if (!contentType || !this.isValidImageContentType(contentType)) {
        throw new ImageProcessingError(
          415,
          'InvalidContentType',
          `Invalid content type: ${contentType ?? 'missing'}`,
          `S3 origin '${url}' returned unsupported Content-Type '${contentType ?? 'missing'}'.`
        );
      }

      return { buffer, contentType };
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid S3 URL format') {
        throw new ImageProcessingError(400, 'InvalidS3Url', 'Invalid S3 URL format', `Failed to parse S3 URL '${url}': ${error.message}`);
      }
      throw this.handleFetchError(error, url);
    }
  }

  private async fetchFromHttp(url: string, headers?: Record<string, string>): Promise<{ buffer: Buffer; contentType?: string }> {
    const controller = new AbortController();
    // Keep the timer armed through the body read (cleared only in finally), else a trickling origin
    // holds the socket past httpTimeout; an abort mid-read surfaces as 504 RequestTimeout (Post 8).
    const timeoutId = setTimeout(() => controller.abort(), this.httpTimeout);

    try {
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'DIT-v8-ImageProcessor/1.0',
        ...headers
      };

      const response = await fetch(url, {
        method: 'GET',
        // Don't follow redirects: a redirect hop isn't re-validated and could reach a destination
        // that bypassed origin validation. Matches the HEAD preflight, which already uses 'error'.
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: 'error'
      });

      if (!response.ok) {
        throw new ImageProcessingError(
          response.status,
          'HttpFetchError',
          'Failed to fetch image',
          `HTTP ${response.status} ${response.statusText} returned from origin '${url}'.`
        );
      }

      // Fail closed on a missing or non-image Content-Type: without this, a zero-transformation
      // request returns an internal response body unmodified, i.e. an SSRF read (finding a3ede07f).
      const contentType = response.headers.get('content-type');
      if (!contentType || !this.isValidImageContentType(contentType)) {
        throw new ImageProcessingError(
          415,
          'InvalidContentType',
          `Invalid content type: ${contentType ?? 'missing'}`,
          `Origin '${url}' returned unsupported Content-Type '${contentType ?? 'missing'}'.`
        );
      }

      // Still under the abort timer: an abort here rejects → mapped to 504 below.
      const arrayBuffer = await response.arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer), contentType: contentType || undefined };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ImageProcessingError(504, 'RequestTimeout', 'Origin request timeout', `HTTP request to '${url}' exceeded ${this.httpTimeout}ms timeout.`);
      }
      // fetch() surfaces a blocked redirect as a TypeError with this cause; map it to 502 rather
      // than letting it fall through to a generic 500.
      if (error?.cause?.message === 'unexpected redirect') {
        throw new ImageProcessingError(502, 'RedirectNotAllowed', 'Origin redirect not allowed', `Origin '${url}' returned a redirect, which is not followed for security reasons.`);
      }
      throw this.handleFetchError(error, url);
    } finally {
      // Always clear on every path (success, non-ok, abort, throw) so the handle is never leaked.
      clearTimeout(timeoutId);
    }
  }



  /** Lower-cased media type with any parameters (e.g. '; charset=...') stripped. */
  private normalizeMediaType(contentType: string): string {
    return contentType.split(';')[0].trim().toLowerCase();
  }

  private isValidImageContentType(contentType: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/avif',
      'image/heif',
      'image/svg+xml',
    ];
    // Exact match, not substring: 'application/json; charset=image/jpeg' must not pass (finding a3ede07f).
    return validTypes.includes(this.normalizeMediaType(contentType));
  }

  private validateImageMagicNumbers(buffer: Buffer, contentType: string | undefined, url: string): void {
    // Where applicable the first 4 bytes are checked against that formats starting sequence.
    // For formats with inconsistent or non-existant starting sequences(av1, raw, etc) this validation is skipped.

    // SVG is text with no reliable byte signature, so it can't be magic-validated; accepted residual.
    if (contentType?.includes('svg')) return;

    if (buffer.length < 4) {
      throw new ImageProcessingError(415, 'InvalidImage', 'Invalid image file', `Image from '${url}' is only ${buffer.length} bytes, too small to be a valid image.`);
    }

    // avif/heif are ISOBMFF: every valid file has the ASCII 'ftyp' box at byte 4. We check only for
    // that, not the brand — the brand set isn't exhaustive, so a brand allowlist would eventually
    // reject legitimate images. Requiring 'ftyp' is enough to stop the raw-body read: an arbitrary
    // non-image body (JSON, HTML, text) won't carry 'ftyp' at offset 4.
    if (contentType === 'image/avif' || contentType === 'image/heif') {
      if (buffer.length < 8 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
        throw new ImageProcessingError(415, 'InvalidImage', 'Invalid image file', `Image from '${url}': Content-Type '${contentType}' but no ISOBMFF 'ftyp' box was found.`);
      }
      return;
    }

    const magicToFormat = {
      'FFD8FF': 'jpeg',
      '89504E47': 'png', 
      '47494638': 'gif',
      '52494646': 'webp',
      '49492A00': 'tiff',
      '4D4D002A': 'tiff'
    };

    const contentTypeToFormat = {
      'image/webp': 'webp',
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpeg',
      'image/tiff': 'tiff',
      'image/gif': 'gif'
    };

    const fileHeader = buffer.subarray(0, 4).toString('hex').toUpperCase();
    let detectedFormat: string | undefined;
    
    for (const [magic, format] of Object.entries(magicToFormat)) {
      if (fileHeader.startsWith(magic)) {
        detectedFormat = format;
        break;
      }
    }

    if (contentType) {
      const expectedFormat = contentTypeToFormat[contentType.toLowerCase()];
      // If no expectedFormat found, skip magic number validation
      if (expectedFormat) {
        if (!detectedFormat) {
          throw new ImageProcessingError(415, 'InvalidImage', 'Invalid image file', `Image from '${url}': Content-Type indicates ${expectedFormat} but file header '${fileHeader}' does not match any known ${expectedFormat} magic number.`);
        }
        if (expectedFormat !== detectedFormat) {
          throw new ImageProcessingError(415, 'InvalidImage', 'Content-Type mismatch', `Image from '${url}': Content-Type '${contentType}' indicates ${expectedFormat} but magic number detected ${detectedFormat}.`);
        }
      }
    }
  }

  private handleFetchError(error: any, url: string): ImageProcessingError {
    if (error instanceof ImageProcessingError) {
      return error;
    }

    const mappedError = S3ErrorHandler.mapError(error);
    if (mappedError) {
      const errorType = mappedError.errorType === 'KeyNotFound' ? 'ImageNotFound' : mappedError.errorType;
      return new ImageProcessingError(mappedError.statusCode, errorType, mappedError.message, `S3 error fetching '${url}': ${error.message || error.name}`);
    }

    return new ImageProcessingError(
      500,
      'FetchError',
      'Failed to fetch image',
      `Unexpected error fetching '${url}': ${error.name} - ${error.message}`
    );
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url.split('?')[0]; // Fallback: remove query params
    }
  }
}