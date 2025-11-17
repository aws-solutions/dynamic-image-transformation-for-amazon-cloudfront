// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionError } from '../errors/connection.error';
import { ImageProcessingRequest } from '../../../types/image-processing-request';
import axios from 'axios';
import https from 'https';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getOptions } from '../../../utils/get-options';
import { S3UrlHelper } from '../../../utils/s3-url-helper';
import { UrlValidator } from '../../../utils/url-validator';

export class ConnectionManager {
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: true });
  private readonly s3Client = new S3Client(getOptions());

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
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 0,
        httpsAgent: this.httpsAgent,
        headers: imageRequest.clientHeaders || {}
      });

      const contentType = response.headers['content-type'];
      this.validateContentType(contentType);
      if (imageRequest) {
        imageRequest.sourceImageContentType = contentType;
      }
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        // HTTP response errors (4xx, 5xx)
        if (error.response) {
          const status = error.response.status;
          if (status === 404) {
            throw new ConnectionError('Resource not found', `Resource not found at ${url}`, 404, 'RESOURCE_NOT_FOUND');
          }
          if (status === 403 || status === 401) {
            throw new ConnectionError('Access denied', `Access denied for ${url}`, status, 'ACCESS_DENIED');
          }
          if (status >= 500) {
            throw new ConnectionError('Origin server error', `Origin server error (${status}) for ${url}`, 502, 'BAD_GATEWAY');
          }
        }        
        // Network-level errors
        if (error.code === 'ECONNABORTED') {
          throw new ConnectionError('Origin timeout', `Origin validation timeout after 5000ms for URL: ${url}`, 408, 'REQUEST_TIMEOUT');
        }
        if (error.code === 'ENOTFOUND') {
          throw new ConnectionError('Unable to resolve host', `Unable to resolve host for ${url}`, 404, 'HOST_NOT_FOUND');
        }
        if (error.code === 'CERT_UNTRUSTED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          throw new ConnectionError('TLS certificate error', `TLS certificate validation failed for ${url}: ${error.message}`, 403, 'ACCESS_DENIED');
        }
      }
      throw new ConnectionError('Origin validation failed', `Origin validation failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`, 502, 'BAD_GATEWAY');
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