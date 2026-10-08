// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionError } from '../errors/connection.error';
import { ImageProcessingRequest } from '../../../types/image-processing-request';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getOptions } from '../../../utils/get-options';
import { S3UrlHelper } from '../../../utils/s3-url-helper';
import { UrlValidator } from '../../../utils/url-validator';
import { OriginFetcher } from '../../image-processing/origin-fetcher';
import { ImageProcessingError } from '../../image-processing/types';

/**
 * Fetches the origin image once: the same GET validates the connection and content type
 * (the old HEAD preflight's error contract) and returns the bytes for image processing.
 */
export class ConnectionManager {
  private static readonly TOTAL_TIMEOUT_MS = 30000;
  private static readonly USER_AGENT = 'DIT-v8-ImageProcessor/1.0';
  private readonly s3Client = new S3Client({ ...getOptions(), followRegionRedirects: true });

  constructor(private readonly originFetcher: OriginFetcher = new OriginFetcher()) {}

  async fetchOriginImage(url: string, imageRequest: ImageProcessingRequest, originHeaders?: Record<string, string>): Promise<void> {
    const start = Date.now();
    try {
      UrlValidator.validate(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid URL';
      const errorCode = message.includes('protocol') ? 'UNSUPPORTED_PROTOCOL' : 'INVALID_URL';
      throw new ConnectionError('URL validation failed', message, 400, errorCode);
    }

    const isS3 = S3UrlHelper.isS3Url(url);
    const { buffer, contentType } = isS3
      ? await this.fetchS3(url, originHeaders)
      : await this.fetchHttp(url, originHeaders);

    const mediaType = this.originFetcher.validateImage(buffer, contentType, url);
    const fetchDurationMs = Date.now() - start;
    this.originFetcher.logImageFetched({
      requestId: imageRequest.requestId,
      originType: isS3 ? 's3' : 'http',
      url,
      mediaType,
      sizeBytes: buffer.length,
      fetchDurationMs
    });

    imageRequest.sourceImageContentType = contentType;
    imageRequest.sourceImage = { buffer, contentType, format: mediaType?.replace('image/', ''), fetchDurationMs };
  }

  private validateContentType(contentType: string | undefined): void {
    if (!contentType?.split(';')[0].trim().startsWith('image/')) {
      throw new ConnectionError('Invalid content type', `Origin does not serve image content. Content-Type: ${contentType}`, 400, 'INVALID_FORMAT');
    }
  }

  private async fetchS3(
    url: string,
    originHeaders: Record<string, string> | undefined
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // S3 keeps the SDK's default deadline, as both of the previous S3 calls did.
    let response;
    try {
      const { bucket, key } = S3UrlHelper.parseS3Url(url);
      const commandInput: any = { Bucket: bucket, Key: key };
      Object.entries(originHeaders ?? {}).forEach(([name, value]) => {
        const lowerName = name.toLowerCase();
        if (lowerName.startsWith('x-amz-') || lowerName.startsWith('if-')) {
          commandInput[S3UrlHelper.mapHeaderToS3Property(lowerName)] = value;
        }
      });
      response = await this.s3Client.send(new GetObjectCommand(commandInput));
    } catch (error: any) {
      if (error instanceof Error && error.message === 'Invalid S3 URL format') {
        throw new ConnectionError('Invalid S3 URL format', `Invalid S3 URL format: ${url}`, 400, 'INVALID_URL');
      }
      const statusCode = error?.$metadata?.httpStatusCode;
      if (statusCode === 404) {
        throw new ConnectionError('Resource not found', `S3 object not found: ${url}`, 404, 'RESOURCE_NOT_FOUND');
      }
      if (statusCode === 403) {
        throw new ConnectionError('Access denied', `Access denied to S3 resource: ${url}`, 403, 'ACCESS_DENIED');
      }
      throw new ConnectionError('S3 validation failed', `S3 validation failed for ${url}: ${error?.message}`, 502, 'BAD_GATEWAY');
    }

    const contentType = response.ContentType;
    try {
      this.validateContentType(contentType);
      this.originFetcher.assertAllowedContentType(contentType, url, 's3');
    } catch (error) {
      // Release the pooled socket when we reject a response without reading its body.
      (response.Body as any)?.destroy?.();
      throw error;
    }

    if (!response.Body) {
      throw new ImageProcessingError(404, 'ImageNotFound', 'Image not found in S3', `S3 GetObject returned empty body for '${url}'.`);
    }
    try {
      const body = response.Body as any;
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(await body.transformToByteArray());
      return { buffer, contentType: contentType! };
    } catch (error: any) {
      throw new ImageProcessingError(500, 'FetchError', 'Failed to fetch image', `Unexpected error reading S3 body for '${url}': ${error?.name} - ${error?.message}`);
    }
  }

  private async fetchHttp(
    url: string,
    originHeaders: Record<string, string> | undefined
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // One 30s deadline covering headers and body, matching the image GET before the preflight was removed.
    const controller = new AbortController();
    const totalTimer = setTimeout(() => controller.abort(), ConnectionManager.TOTAL_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          // A redirect hop isn't re-validated and could reach a destination that bypassed origin validation.
          redirect: 'error',
          signal: controller.signal,
          headers: { 'User-Agent': ConnectionManager.USER_AGENT, ...originHeaders }
        });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          throw this.timeoutError(url);
        }
        throw this.mapNetworkError(error, url);
      }

      try {
        this.checkStatus(response, url);
        const contentType = response.headers.get('content-type') ?? undefined;
        this.validateContentType(contentType);
        this.originFetcher.assertAllowedContentType(contentType, url, 'http');

        let arrayBuffer: ArrayBuffer;
        try {
          arrayBuffer = await response.arrayBuffer();
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            throw this.timeoutError(url);
          }
          throw new ImageProcessingError(500, 'FetchError', 'Failed to fetch image', `Unexpected error reading body from '${url}': ${error?.name} - ${error?.message}`);
        }
        return { buffer: Buffer.from(arrayBuffer), contentType: contentType! };
      } catch (error) {
        // Release the socket when we reject a response without reading its body.
        response.body?.cancel().catch(() => {});
        throw error;
      }
    } finally {
      clearTimeout(totalTimer);
    }
  }

  private checkStatus(response: Response, url: string): void {
    if (response.ok) return;
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

  private timeoutError(url: string): ImageProcessingError {
    return new ImageProcessingError(504, 'RequestTimeout', 'Origin request timeout', `HTTP request to '${url}' exceeded ${ConnectionManager.TOTAL_TIMEOUT_MS}ms timeout.`);
  }

  private mapNetworkError(error: unknown, url: string): ConnectionError {
    const err = error as Error & { cause?: { code?: string } };
    const code = err.cause?.code;
    if (code === 'ENOTFOUND') {
      return new ConnectionError('Unable to resolve host', `Unable to resolve host for ${url}`, 404, 'HOST_NOT_FOUND');
    }
    if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      return new ConnectionError('TLS certificate error', `TLS certificate validation failed for ${url}: ${err.message}`, 403, 'ACCESS_DENIED');
    }
    return new ConnectionError('Origin validation failed', `Origin validation failed for ${url}: ${err.message || 'Unknown error'}`, 502, 'BAD_GATEWAY');
  }
}
