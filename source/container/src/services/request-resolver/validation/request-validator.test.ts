// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RequestValidator } from './request-validator';
import { ValidationError } from '../errors/validation.error';

describe('RequestValidator', () => {
  let requestValidator: RequestValidator;

  beforeEach(() => {
    requestValidator = new RequestValidator();
  });

  describe('validateRequest', () => {
    it('should validate valid requests', () => {
      const mockReq = {
        path: '/images/test.jpg',
        get: jest.fn().mockReturnValue('example.com')
      } as any;

      expect(() => requestValidator.validateRequest(mockReq)).not.toThrow();
    });

    it('should throw ValidationError for invalid path', () => {
      const mockReq = {
        path: 'invalid-path',
        get: jest.fn().mockReturnValue('example.com')
      } as any;

      expect(() => requestValidator.validateRequest(mockReq)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid host header', () => {
      const mockReq = {
        path: '/valid/path',
        get: jest.fn().mockReturnValue('invalid host with spaces')
      } as any;

      expect(() => requestValidator.validateRequest(mockReq)).toThrow(ValidationError);
    });
  });

  describe('validatePath', () => {
    it('should accept valid paths', () => {
      expect(requestValidator.validatePath('/images/test.jpg')).toBe(true);
      expect(requestValidator.validatePath('/')).toBe(true);
      expect(requestValidator.validatePath('/api/v1/images')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(requestValidator.validatePath('')).toBe(false);
      expect(requestValidator.validatePath('no-leading-slash')).toBe(false);
      expect(requestValidator.validatePath('/path\x00with\x00nulls')).toBe(false);
    });
  });

  describe('validateHostHeader', () => {
    it('should accept valid host headers', () => {
      expect(requestValidator.validateHostHeader('example.com')).toBe(true);
      expect(requestValidator.validateHostHeader('sub.example.com')).toBe(true);
      expect(requestValidator.validateHostHeader('example.com:8080')).toBe(true);
    });

    it('should reject invalid host headers', () => {
      expect(requestValidator.validateHostHeader('')).toBe(false);
      expect(requestValidator.validateHostHeader('invalid host with spaces')).toBe(false);
      expect(requestValidator.validateHostHeader('a'.repeat(300))).toBe(false);
    });
  });
});