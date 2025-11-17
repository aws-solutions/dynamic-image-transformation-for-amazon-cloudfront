// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UrlValidator } from './url-validator';

describe('UrlValidator', () => {
  describe('validate', () => {
    it('should validate HTTPS URLs', () => {
      expect(() => UrlValidator.validate('https://example.com/image.jpg')).not.toThrow();
    });

    it('should validate S3 URLs', () => {
      expect(() => UrlValidator.validate('https://my-bucket.s3.amazonaws.com/image.jpg')).not.toThrow();
    });

    it('should reject HTTP URLs for non-localhost', () => {
      expect(() => UrlValidator.validate('http://example.com/image.jpg'))
        .toThrow('HTTP protocol not allowed');
    });

    it('should allow HTTP for localhost', () => {
      expect(() => UrlValidator.validate('http://localhost:3000/image.jpg')).not.toThrow();
      expect(() => UrlValidator.validate('http://127.0.0.1:3000/image.jpg')).not.toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => UrlValidator.validate('invalid-url')).toThrow('Invalid URL');
    });

    it('should reject empty URLs', () => {
      expect(() => UrlValidator.validate('')).toThrow('Invalid URL');
    });

    it('should reject unsupported protocols', () => {
      expect(() => UrlValidator.validate('ftp://example.com/image.jpg'))
        .toThrow('Unsupported protocol');
    });
  });
});
