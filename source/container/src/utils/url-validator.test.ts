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

    describe('private / link-local address blocking (SSRF)', () => {
      it('should allow public IPv4 and IPv6 literals', () => {
        expect(() => UrlValidator.validate('https://8.8.8.8/image.jpg')).not.toThrow();
        expect(() => UrlValidator.validate('https://11.0.0.1/image.jpg')).not.toThrow();
        expect(() => UrlValidator.validate('https://172.15.0.1/image.jpg')).not.toThrow();
        expect(() => UrlValidator.validate('https://100.128.0.1/image.jpg')).not.toThrow();
        expect(() => UrlValidator.validate('https://[2001:4860:4860::8888]/image.jpg')).not.toThrow();
      });

      it('should reject RFC-1918 private IPv4 ranges', () => {
        expect(() => UrlValidator.validate('https://10.0.0.5/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://172.16.3.4/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://192.168.1.1/image.jpg')).toThrow('private or non-routable');
      });

      it('should reject link-local IPv4 (169.254.0.0/16), including the IMDS/ECS credentials address', () => {
        expect(() => UrlValidator.validate('https://169.254.169.254/latest/meta-data/')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://169.254.170.2/v2/credentials/')).toThrow('private or non-routable');
      });

      it('should reject CGNAT (100.64.0.0/10) and 0.0.0.0/8', () => {
        expect(() => UrlValidator.validate('https://100.64.0.1/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://0.0.0.0/image.jpg')).toThrow('private or non-routable');
      });

      it('should reject IPv4 alternate encodings that canonicalize to private addresses', () => {
        // Node's URL parser canonicalizes integer/hex host forms to dotted-decimal; both of these
        // resolve to the link-local 169.254.169.254 (chosen over a loopback form so the test-mode
        // loopback allowance cannot mask the result).
        expect(() => UrlValidator.validate('https://2852039166/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://0xA9FEA9FE/image.jpg')).toThrow('private or non-routable');
      });

      it('should reject private / link-local / ULA IPv6 literals', () => {
        expect(() => UrlValidator.validate('https://[fe80::1]/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://[fc00::1]/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://[fd12:3456::1]/image.jpg')).toThrow('private or non-routable');
      });

      it('should reject IPv4-mapped IPv6 literals that embed a private address', () => {
        expect(() => UrlValidator.validate('https://[::ffff:169.254.169.254]/image.jpg')).toThrow('private or non-routable');
        expect(() => UrlValidator.validate('https://[::ffff:a9fe:a9fe]/image.jpg')).toThrow('private or non-routable');
      });

      it('should not block public hostnames (DNS resolution is out of scope for this check)', () => {
        expect(() => UrlValidator.validate('https://example.com/image.jpg')).not.toThrow();
        expect(() => UrlValidator.validate('https://my-bucket.s3.amazonaws.com/image.jpg')).not.toThrow();
      });
    });
  });
});
