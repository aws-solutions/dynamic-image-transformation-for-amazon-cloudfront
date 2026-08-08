// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionError } from '../errors/connection.error';
import { ImageProcessingRequest } from '../../../types/image-processing-request';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getOptions } from '../../../utils/get-options';
import { S3UrlHelper } from '../../../utils/s3-url-helper';
import { UrlValidator } from '../../../utils/url-validator';

export class ConnectionManager {
  private static readonly TIMEOUT_MS = 5000;
  private readonly s3Client = new S3Client({ ...getOptions(), followRegionRedirects: true });

  private validateContentType(contentType: string | undefined): void {
    if (!contentType?.split(';')[0].trim().startsWith('image/')) {
      throw new ConnectionError('Invalid content type', `Origin does not serve image content. Content-Type: ${contentType}`, 400, 'INVALID_FORMAT');
    }
  }

  private async validateS3Origin(url: string, imageRequest: ImageProcessingRequest): Promise<void> {
    try {
      const { bucket, key } = S3UrlHelper.parseS3Url(url);
      
      const commandInput: any = { Bucket: bucket, Key: key };
      
      if (imageRequest.clientHeaders) {
        Object.entries(imageRequest.clientHeaders).forEach(([name, value]) => {
          const lowerName = name.toLowerCase();
          if (lowerName.startsWith('x-amz-') || lowerName.startsWith('if-')) {
            commandInput[S3UrlHelper.mapHeaderToS3Property(lowerName)] = value;
          }
        });
      }
      
      const command = new HeadObjectCommand(commandInput);
      const response = await this.s3Client.send(command);
      
      const contentType = response.ContentType;
      this.validateContentType(contentType);
      if (imageRequest) {
        imageRequest.sourceImageContentType = contentType;
      }
    } catch (error: any) {
      const statusCode = error?.$metadata?.httpStatusCode;

      if (error instanceof ConnectionError) {
        throw error;
      }
      if (error instanceof Error && error.message === 'Invalid S3 URL format') {
        throw new ConnectionError('Invalid S3 URL format', `Invalid S3 URL format: ${url}`, 400, 'INVALID_URL');
      }
      if (statusCode === 404) {
        throw new ConnectionError('Resource not found', `S3 object not found: ${url}`, 404, 'RESOURCE_NOT_FOUND');
      }
      if (statusCode === 403) {
        throw new ConnectionError('Access denied', `Access denied to S3 resource: ${url}`, 403, 'ACCESS_DENIED');
      }
      throw new ConnectionError('S3 validation failed', `S3 validation failed for ${url}: ${error.message}`, 502, 'BAD_GATEWAY');
    }
  }

  private async validateHttpOrigin(url: string, imageRequest: ImageProcessingRequest): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ConnectionManager.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'error',
        signal: controller.signal,
        headers: imageRequest.clientHeaders || {}
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        if (status === 404) {
          throw new ConnectionError('Resource not found', `Resource not found at ${url}`, 404, 'RESOURCE_NOT_FOUND');
        }
        if (status === 403 || status === 401) {
          throw new ConnectionError('Access denied', `Access denied for ${url}`, status, 'ACCESS_DENIED');
        }
        if (status >= 500) {
          throw new ConnectionError('Origin server error', `Origin server error (${status}) for ${url}`, 502, 'BAD_GATEWAY');
        }
        throw new ConnectionError('Origin validation failed', `Origin returned status ${status} for ${url}`, 502, 'BAD_GATEWAY');
      }

      const contentType = response.headers.get('content-type') ?? undefined;
      this.validateContentType(contentType);
      if (imageRequest) {
        imageRequest.sourceImageContentType = contentType;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ConnectionError) throw error;

      const err = error as Error & { cause?: { code?: string } };
      const code = err.cause?.code;

      if (err.name === 'AbortError') {
        throw new ConnectionError('Origin timeout', `Origin validation timeout after ${ConnectionManager.TIMEOUT_MS}ms for URL: ${url}`, 408, 'REQUEST_TIMEOUT');
      }
      if (code === 'ENOTFOUND') {
        throw new ConnectionError('Unable to resolve host', `Unable to resolve host for ${url}`, 404, 'HOST_NOT_FOUND');
      }
      if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        throw new ConnectionError('TLS certificate error', `TLS certificate validation failed for ${url}: ${err.message}`, 403, 'ACCESS_DENIED');
      }
      throw new ConnectionError('Origin validation failed', `Origin validation failed for ${url}: ${err.message || 'Unknown error'}`, 502, 'BAD_GATEWAY');
    }
  }

  async validateOriginHeaders(url: string, imageRequest: ImageProcessingRequest): Promise<void> {    
    if (S3UrlHelper.isS3Url(url)) {
      await this.validateS3Origin(url, imageRequest);
    } else {
      await this.validateHttpOrigin(url, imageRequest);
    }
  }
  
  async validateOriginUrl(url: string, imageRequest: ImageProcessingRequest): Promise<void> {
    const preflightStart = Date.now();
    try {
      UrlValidator.validate(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid URL';
      const errorCode = message.includes('protocol') ? 'UNSUPPORTED_PROTOCOL' : 'INVALID_URL';
      throw new ConnectionError('URL validation failed', message, 400, errorCode);
    }
    await this.validateOriginHeaders(url, imageRequest);
    
    // Store preflight timing
    if (imageRequest.timings?.requestResolution) {
      imageRequest.timings.requestResolution.preflightValidationMs = Date.now() - preflightStart;
    }
  }
}