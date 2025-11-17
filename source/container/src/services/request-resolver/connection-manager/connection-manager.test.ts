// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConnectionManager } from './connection-manager';
import axios from 'axios';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ImageProcessingRequest } from '../../../types/image-processing-request';
import { UrlValidator } from '../../../utils/url-validator';
import { S3UrlHelper } from '../../../utils/s3-url-helper';

jest.mock('axios');
jest.mock('@aws-sdk/client-s3');
jest.mock('../../../utils/get-options', () => ({ getOptions: () => ({}) }));
jest.mock('../../../utils/url-validator');
jest.mock('../../../utils/s3-url-helper');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockImageRequest: ImageProcessingRequest;
  let mockS3Send: jest.Mock;

  beforeEach(() => {
    mockS3Send = jest.fn();
    (S3Client as jest.Mock).mockImplementation(() => ({ send: mockS3Send }));
    connectionManager = new ConnectionManager();
    mockImageRequest = {} as ImageProcessingRequest;
    jest.clearAllMocks();
  });

  describe('validateOriginUrl', () => {
    beforeEach(() => {
      (S3UrlHelper.isS3Url as jest.Mock).mockReturnValue(false);
      (UrlValidator.validate as jest.Mock).mockImplementation(() => {});
    });

    it('should validate valid HTTPS URL', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'image/jpeg' }
      });

      await connectionManager.validateOriginUrl('https://example.com/image.jpg', mockImageRequest);
      
      expect(UrlValidator.validate).toHaveBeenCalledWith('https://example.com/image.jpg');
      expect(mockedAxios.head).toHaveBeenCalledWith('https://example.com/image.jpg', {
        timeout: 5000,
        maxRedirects: 0,
        httpsAgent: expect.any(Object),
        headers: {}
      });
    });

    it('should populate sourceImageContentType in imageRequest', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'image/png' }
      });

      await connectionManager.validateOriginUrl('https://example.com/image.png', mockImageRequest);
      expect(mockImageRequest.sourceImageContentType).toBe('image/png');
    });

    it('should reject unsupported protocol with UNSUPPORTED_PROTOCOL error code', async () => {
      (UrlValidator.validate as jest.Mock).mockImplementation(() => {
        throw new Error('Unsupported protocol');
      });

      await expect(connectionManager.validateOriginUrl('ftp://example.com/image.jpg', mockImageRequest))
        .rejects.toMatchObject({
          title: 'URL validation failed',
          errorType: 'UNSUPPORTED_PROTOCOL',
          statusCode: 400
        });
    });

    it('should reject non-image content types', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'text/html' }
      });

      await expect(connectionManager.validateOriginUrl('https://example.com/file', mockImageRequest))
        .rejects.toMatchObject({
          title: 'Invalid content type',
          errorType: 'INVALID_FORMAT',
          statusCode: 400
        });
    });

    it('should accept image content type with charset', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'image/jpeg; charset=utf-8' }
      });

      await connectionManager.validateOriginUrl('https://example.com/image.jpg', mockImageRequest);
      expect(mockImageRequest.sourceImageContentType).toBe('image/jpeg; charset=utf-8');
    });

    it('should pass clientHeaders to axios', async () => {
      mockImageRequest.clientHeaders = { 'User-Agent': 'test-agent' };
      mockedAxios.head.mockResolvedValue({
        headers: { 'content-type': 'image/jpeg' }
      });

      await connectionManager.validateOriginUrl('https://example.com/image.jpg', mockImageRequest);
      
      expect(mockedAxios.head).toHaveBeenCalledWith('https://example.com/image.jpg', {
        timeout: 5000,
        maxRedirects: 0,
        httpsAgent: expect.any(Object),
        headers: { 'User-Agent': 'test-agent' }
      });
    });

    it('should validate S3 URLs with client headers', async () => {
      (S3UrlHelper.isS3Url as jest.Mock).mockReturnValue(true);
      (S3UrlHelper.parseS3Url as jest.Mock).mockReturnValue({ bucket: 'test-bucket', key: 'test-key.jpg' });

      mockS3Send.mockResolvedValue({ ContentType: 'image/jpeg' });

      await connectionManager.validateOriginUrl('https://bucket.s3.amazonaws.com/key.jpg', mockImageRequest);
      
      expect(S3UrlHelper.parseS3Url).toHaveBeenCalledWith('https://bucket.s3.amazonaws.com/key.jpg');
      expect(mockS3Send).toHaveBeenCalled();
      expect(mockImageRequest.sourceImageContentType).toBe('image/jpeg');
    });

    it('should handle invalid S3 URL format', async () => {
      (S3UrlHelper.isS3Url as jest.Mock).mockReturnValue(true);
      (S3UrlHelper.parseS3Url as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid S3 URL format');
      });

      await expect(connectionManager.validateOriginUrl('https://bucket.s3.amazonaws.com/invalid', mockImageRequest))
        .rejects.toMatchObject({
          title: 'Invalid S3 URL format',
          errorType: 'INVALID_URL',
          statusCode: 400
        });
    });
  });
});