// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { validateOrigin, validateOriginCreate, validateOriginUpdate } from '../origin';

describe('Origin Schema Validation', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const validDateTime = '2023-01-01T00:00:00.000Z';

  const createValidOrigin = (overrides = {}) => ({
    originId: validUuid,
    originName: 'Test Origin',
    originDomain: 'example.com',
    createdAt: validDateTime,
    ...overrides,
  });

  describe('originNameSchema', () => {
    describe('valid names', () => {
      test.each([
        'API Origin',
        'test-origin-123',
        'my_origin_v2',
        'Origin 1',
        'SimpleOrigin',
        'a',
        'A'.repeat(100), // max length
      ])('should accept valid origin name: %s', (name) => {
        const origin = createValidOrigin({ originName: name });
        const result = validateOrigin(origin);
        expect(result.success).toBe(true);
      });

      test('should trim whitespace from origin name', () => {
        const origin = createValidOrigin({ originName: '  Test Origin  ' });
        const result = validateOrigin(origin);
        expect(result.success).toBe(true);
        expect(result.data?.originName).toBe('Test Origin');
      });
    });

    describe('invalid names', () => {
      test.each([
        ['', 'empty string'],
        ['origin@api', 'contains @'],
        ['origin.com', 'contains dot'],
        ['origin/path', 'contains slash'],
        ['origin#tag', 'contains hash'],
        ['origin\u00A0name', 'unicode space'],
        ['A'.repeat(101), 'too long'],
      ])('should reject invalid origin name: %s (%s)', (name) => {
        const origin = createValidOrigin({ originName: name });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('originDomainSchema', () => {
    describe('valid domains', () => {
      test.each([
        'example.com',
        'api.example.com',
        'sub.domain.example.co.uk',
        'a.com',
        'test123.example.org',
        'my-api.example.com',
      ])('should accept valid domain: %s', (domain) => {
        const origin = createValidOrigin({ originDomain: domain });
        const result = validateOrigin(origin);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid domains', () => {
      test.each([
        ['', 'empty string'],
        ['.example.com', 'starts with dot'],
        ['example.com.', 'ends with dot'],
        ['-example.com', 'starts with hyphen'],
        ['example-.com', 'ends with hyphen'],
        ['example..com', 'consecutive dots'],
        ['example.c', 'TLD too short'],
        ['example com', 'contains space'],
        ['*.example.com', 'contains wildcard'],
      ])('should reject invalid domain: %s (%s)', (domain) => {
        const origin = createValidOrigin({ originDomain: domain });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('originPathSchema', () => {
    describe('valid paths', () => {
      test.each([
        '/api',
        '/api/v1',
        '/images/thumbnails',
        '/api_v1',
        '/api-v1',
        '/deep/nested/path/structure',
      ])('should accept valid path: %s', (path) => {
        const origin = createValidOrigin({ originPath: path });
        const result = validateOrigin(origin);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid paths', () => {
      test.each([
        ['', 'empty string'],
        ['/', 'root path only'],
        ['api', 'no leading slash'],
        ['//api', 'consecutive slashes'],
        ['/api?query=1', 'contains query param'],
        ['/api#fragment', 'contains fragment'],
        ['/api with space', 'contains space'],
        ['/api@endpoint', 'contains @'],
        ['/path.json', 'file with extension'],
        ['/api.html', 'file with extension'],
        ['/config.', 'ends with dot'],
        ['/' + 'a'.repeat(2048), 'too long'],
      ])('should reject invalid path: %s (%s)', (path) => {
        const origin = createValidOrigin({ originPath: path });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('originHeadersSchema', () => {
    describe('valid headers', () => {
      test('should accept valid headers', () => {
        const origin = createValidOrigin({
          originHeaders: {
            'x-api-key': 'test-key-123',
            'content-type': 'application/json',
            'authorization': 'Bearer token123',
          }
        });
        const result = validateOrigin(origin);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid headers', () => {
      test('should reject invalid header names', () => {
        const origin = createValidOrigin({
          originHeaders: {
            'invalid header name': 'value', // spaces not allowed in header names
          }
        });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });

      test('should reject empty header names', () => {
        const origin = createValidOrigin({
          originHeaders: {
            '': 'value',
          }
        });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });

      test('should reject empty header values', () => {
        const origin = createValidOrigin({
          originHeaders: {
            'x-api-key': '',
          }
        });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('UUID schemas', () => {
    describe('valid UUIDs', () => {
      test('should accept valid UUID v4', () => {
        const origin = createValidOrigin();
        const result = validateOrigin(origin);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid UUIDs', () => {
      test.each([
        ['', 'empty string'],
        ['not-a-uuid', 'invalid format'],
        ['550e8400-e29b-41d4-a716', 'incomplete UUID'],
        ['550e8400e29b41d4a716446655440000', 'no hyphens'],
        ['6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'UUID v1, not v4'],
      ])('should reject invalid UUID: %s (%s)', (uuid) => {
        const origin = createValidOrigin({ originId: uuid });
        const result = validateOrigin(origin);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('OriginSchema', () => {
    test('should validate complete origin with all fields', () => {
      const origin = createValidOrigin({
        originPath: '/api/v1',
        originHeaders: { 'x-api-key': 'test-key' },
        updatedAt: validDateTime,
      });
      const result = validateOrigin(origin);
      expect(result.success).toBe(true);
    });

    test('should validate minimal origin', () => {
      const origin = createValidOrigin();
      const result = validateOrigin(origin);
      expect(result.success).toBe(true);
    });

    test('should require originId, originName, originDomain, createdAt', () => {
      const result = validateOrigin({});
      expect(result.success).toBe(false);
    });

    test('should reject extra fields', () => {
      const origin = createValidOrigin({ extraField: 'not allowed' });
      const result = validateOrigin(origin);
      expect(result.success).toBe(false);
    });
  });

  describe('OriginCreateSchema', () => {
    test('should validate create request with all fields', () => {
      const result = validateOriginCreate({
        originName: 'Test Origin',
        originDomain: 'example.com',
        originPath: '/api',
        originHeaders: { 'x-api-key': 'test' }
      });
      expect(result.success).toBe(true);
    });

    test('should validate minimal create request', () => {
      const result = validateOriginCreate({
        originName: 'Test Origin',
        originDomain: 'example.com'
      });
      expect(result.success).toBe(true);
    });

    test('should require originName and originDomain', () => {
      const result = validateOriginCreate({});
      expect(result.success).toBe(false);
    });
  });

  describe('OriginUpdateSchema', () => {
    test('should reject empty update request', () => {
      const result = validateOriginUpdate({});
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('At least one field must be provided for update');
    });

    test('should validate update with originName only', () => {
      const result = validateOriginUpdate({ originName: 'Updated Origin' });
      expect(result.success).toBe(true);
    });

    test('should validate update with originDomain only', () => {
      const result = validateOriginUpdate({ originDomain: 'updated.com' });
      expect(result.success).toBe(true);
    });

    test('should validate update with originPath only', () => {
      const result = validateOriginUpdate({ originPath: '/updated/path' });
      expect(result.success).toBe(true);
    });

    test('should validate update with originHeaders only', () => {
      const result = validateOriginUpdate({ 
        originHeaders: { 'x-updated-key': 'new-value' }
      });
      expect(result.success).toBe(true);
    });
  });
});
