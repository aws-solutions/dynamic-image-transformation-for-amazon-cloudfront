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

    this.validateImageMagicNumbers(result.buffer, result.contentType, url);
    const fetchDurationMs = Date.now() - startTime;
    
    console.log(JSON.stringify({
      requestId: requestId || 'unknown',
      component: 'OriginFetcher',
      operation: 'image_fetched',
      originType: S3UrlHelper.isS3Url(url) ? 's3' : 'http',
      url: this.sanitizeUrl(url),
      contentType: result.contentType,
      sizeBytes: result.buffer.length,
      fetchDurationMs
    }));
    
    const format = result.contentType?.replace('image/', '');
    return {
      buffer: result.buffer,
      metadata: {
        size: result.buffer.length,
        format
      }
    };
  }

  private async fetchFromS3(url: string, headers?: Record<string, string>): Promise<{ buffer: Buffer; contentType?: string }> {
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
      
      return { buffer, contentType: response.ContentType };
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid S3 URL format') {
        throw new ImageProcessingError(400, 'InvalidS3Url', 'Invalid S3 URL format', `Failed to parse S3 URL '${url}': ${error.message}`);
      }
      throw this.handleFetchError(error, url);
    }
  }

  private async fetchFromHttp(url: string, headers?: Record<string, string>): Promise<{ buffer: Buffer; contentType?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.httpTimeout);

      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'DIT-v8-ImageProcessor/1.0',
        ...headers
      };

      const response = await fetch(url, {
        method: 'GET',
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ImageProcessingError(
          response.status,
          'HttpFetchError',
          'Failed to fetch image',
          `HTTP ${response.status} ${response.statusText} returned from origin '${url}'.`
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !this.isValidImageContentType(contentType)) {
        throw new ImageProcessingError(
          415,
          'InvalidContentType',
          `Invalid content type: ${contentType}`,
          `Origin '${url}' returned unsupported Content-Type '${contentType}'.`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer), contentType: contentType || undefined };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ImageProcessingError(504, 'RequestTimeout', 'Origin request timeout', `HTTP request to '${url}' exceeded ${this.httpTimeout}ms timeout.`);
      }
      throw this.handleFetchError(error, url);
    }
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
      'image/x-icon',              
      'image/vnd.microsoft.icon',  
      'image/ico',                 
      'image/svg+xml',
      'image/bmp',          // Issue #13: BMP passthrough
      'image/x-bmp',        // Issue #13: legacy variant
      'image/x-ms-bmp',     // Issue #13: Microsoft variant
    ];
    return validTypes.some(type => contentType.toLowerCase().includes(type));
  }


  private validateImageMagicNumbers(buffer: Buffer, contentType: string | undefined, url: string): void {
    // Where applicable the first 4 bytes are checked against that formats starting sequence.
    // For formats with inconsistent or non-existant starting sequences(av1, raw, etc) this validation is skipped.

    if (buffer.length < 4) {
      throw new ImageProcessingError(415, 'InvalidImage', 'Invalid image file', `Image from '${url}' is only ${buffer.length} bytes, too small to be a valid image.`);
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