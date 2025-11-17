// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3UrlHelper } from './s3-url-helper';

describe('S3UrlHelper', () => {
  describe('isS3Url', () => {
    it('should detect path-style S3 URLs', () => {
      expect(S3UrlHelper.isS3Url('https://s3.us-east-1.amazonaws.com/bucket/key.jpg')).toBe(true);
      expect(S3UrlHelper.isS3Url('https://s3-us-west-2.amazonaws.com/bucket/key.jpg')).toBe(true);
    });

    it('should detect virtual-hosted-style S3 URLs', () => {
      expect(S3UrlHelper.isS3Url('https://my-bucket.s3.us-east-1.amazonaws.com/key.jpg')).toBe(true);
      expect(S3UrlHelper.isS3Url('https://my-bucket.s3-us-west-2.amazonaws.com/key.jpg')).toBe(true);
    });

    it('should return false for non-S3 URLs', () => {
      expect(S3UrlHelper.isS3Url('https://example.com/image.jpg')).toBe(false);
      expect(S3UrlHelper.isS3Url('http://cdn.example.com/image.jpg')).toBe(false);
    });
  });

  describe('parseS3Url', () => {
    it('should parse path-style S3 URLs', () => {
      const result = S3UrlHelper.parseS3Url('https://s3.us-east-1.amazonaws.com/my-bucket/path/to/image.jpg');
      expect(result).toEqual({ bucket: 'my-bucket', key: 'path/to/image.jpg' });
    });

    it('should parse virtual-hosted-style S3 URLs', () => {
      const result = S3UrlHelper.parseS3Url('https://my-bucket.s3.us-east-1.amazonaws.com/path/to/image.jpg');
      expect(result).toEqual({ bucket: 'my-bucket', key: 'path/to/image.jpg' });
    });

    it('should throw error for invalid S3 URL format', () => {
      expect(() => S3UrlHelper.parseS3Url('https://example.com/image.jpg')).toThrow('Invalid S3 URL format');
    });
  });

  describe('mapHeaderToS3Property', () => {
    it('should map if-match header', () => {
      expect(S3UrlHelper.mapHeaderToS3Property('if-match')).toBe('IfMatch');
    });

    it('should map if-none-match header', () => {
      expect(S3UrlHelper.mapHeaderToS3Property('if-none-match')).toBe('IfNoneMatch');
    });

    it('should map x-amz headers', () => {
      expect(S3UrlHelper.mapHeaderToS3Property('x-amz-server-side-encryption-customer-algorithm')).toBe('SSECustomerAlgorithm');
      expect(S3UrlHelper.mapHeaderToS3Property('x-amz-request-payer')).toBe('RequestPayer');
    });

    it('should return original header name if not in map', () => {
      expect(S3UrlHelper.mapHeaderToS3Property('custom-header')).toBe('custom-header');
    });
  });
});
