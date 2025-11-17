// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { validateMapping, validateMappingCreate, validateMappingUpdate } from '../mappings';

describe('Mapping Schema Validation', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const validDateTime = '2023-01-01T00:00:00.000Z';

  const createValidMapping = (overrides = {}) => ({
    mappingId: validUuid,
    mappingName: 'Test Mapping',
    originId: validUuid,
    createdAt: validDateTime,
    ...overrides,
  });

  describe('hostHeaderPatternSchema', () => {
    describe('valid patterns', () => {
      test.each([
        'example.com',
        'api.example.com',
        'my-api.example.com',
        '*.example.com',
        'a.com',
        'test123.example.co.uk',
        'sub-domain.example.com',
      ])('should accept valid host pattern: %s', (pattern) => {
        const mapping = createValidMapping({ hostHeaderPattern: pattern });
        const result = validateMapping(mapping);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid patterns', () => {
      test.each([
        ['', 'empty string'],
        ['.example.com', 'starts with dot'],
        ['example.com.', 'ends with dot'],
        ['-example.com', 'starts with hyphen'],
        ['example-.com', 'ends with hyphen'],
        ['example..com', 'consecutive dots'],
        ['ex*ample.com', 'wildcard in middle'],
        ['example.c*m', 'wildcard in TLD'],
        ['example.com/path', 'contains slash'],
        ['example com', 'contains space'],
        ['example@com', 'contains special char'],
      ])('should reject invalid host pattern: %s (%s)', (pattern) => {
        const mapping = createValidMapping({ hostHeaderPattern: pattern });
        const result = validateMapping(mapping);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('pathPatternSchema', () => {
    describe('valid patterns', () => {
      test.each([
        '/',
        '/api',
        '/api/v1',
        '/api/v1/users',
        '/api_v1',
        '/api-v1',
        '/api.json',
        '/path/*',
        '/api/v1/*',
      ])('should accept valid path pattern: %s', (pattern) => {
        const mapping = createValidMapping({ pathPattern: pattern });
        const result = validateMapping(mapping);
        expect(result.success).toBe(true);
      });

      test('should accept path pattern at max length (1023 chars)', () => {
        const longPath = '/' + 'a'.repeat(1020) + '/*';
        const mapping = createValidMapping({ pathPattern: longPath });
        const result = validateMapping(mapping);
        expect(result.success).toBe(true);
        expect(longPath.length).toBe(1023);
      });
    });

    describe('invalid patterns', () => {
      test.each([
        ['', 'empty string'],
        ['api', 'no leading slash'],
        ['//api', 'consecutive slashes'],
        ['/api//', 'consecutive slashes'],
        ['/api*/v1', 'wildcard in middle'],
        ['/api/*/', 'wildcard not at end'],
        ['/api?query=1', 'contains query param'],
        ['/api#fragment', 'contains fragment'],
        ['/api with space', 'contains space'],
      ])('should reject invalid path pattern: %s (%s)', (pattern) => {
        const mapping = createValidMapping({ pathPattern: pattern });
        const result = validateMapping(mapping);
        expect(result.success).toBe(false);
      });

      test('should reject path pattern exceeding max length (1024 chars)', () => {
        const tooLongPath = '/' + 'a'.repeat(1021) + '/*';
        const mapping = createValidMapping({ pathPattern: tooLongPath });
        const result = validateMapping(mapping);
        expect(result.success).toBe(false);
        expect(tooLongPath.length).toBe(1024);
      });
    });
  });

  describe('UUID schemas', () => {
    describe('valid UUIDs', () => {
      test('should accept valid UUID v4 for all ID fields', () => {
        const mapping = createValidMapping({
          hostHeaderPattern: 'api.example.com',
          policyId: '550e8400-e29b-41d4-a716-446655440001',
        });
        const result = validateMapping(mapping);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid UUIDs', () => {
      test.each([
        ['mappingId', ''],
        ['mappingId', 'not-a-uuid'],
        ['mappingId', '550e8400-e29b-41d4-a716'],
        ['originId', '550e8400e29b41d4a716446655440000'],
        ['policyId', '550e8400-e29b-41d4-a716-446655440000-extra'],
        ['mappingId', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'], // UUID v1, not v4
      ])('should reject invalid UUID for %s: %s', (field, uuid) => {
        const mapping = createValidMapping({ 
          hostHeaderPattern: 'api.example.com',
          [field]: uuid 
        });
        const result = validateMapping(mapping);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('mappingName and description validation', () => {
    test('should accept valid mappingName', () => {
      const mapping = createValidMapping({
        mappingName: 'Valid Name 123_-',
        hostHeaderPattern: 'api.example.com'
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(true);
    });

    test('should reject invalid mappingName with special characters', () => {
      const mapping = createValidMapping({
        mappingName: 'Invalid@Name!',
        hostHeaderPattern: 'api.example.com'
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(false);
    });

    test('should reject empty mappingName', () => {
      const mapping = createValidMapping({
        mappingName: '',
        hostHeaderPattern: 'api.example.com'
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(false);
    });

    test('should accept valid description', () => {
      const mapping = createValidMapping({
        description: 'This is a valid description',
        hostHeaderPattern: 'api.example.com'
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(true);
    });

    test('should accept mapping without description (optional)', () => {
      const mapping = createValidMapping({
        hostHeaderPattern: 'api.example.com'
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(true);
    });
  });

  describe('MappingSchema', () => {
    test('should validate complete mapping with hostHeaderPattern only', () => {
      const mapping = createValidMapping({
        hostHeaderPattern: 'api.example.com',
        policyId: validUuid,
        updatedAt: validDateTime,
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(true);
    });

    test('should validate complete mapping with pathPattern only', () => {
      const mapping = createValidMapping({
        pathPattern: '/api/v1/*',
        policyId: validUuid,
        updatedAt: validDateTime,
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(true);
    });

    test('should reject mapping with both hostHeaderPattern and pathPattern', () => {
      const mapping = createValidMapping({
        hostHeaderPattern: 'api.example.com',
        pathPattern: '/api/v1/*',
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Exactly one of hostHeaderPattern or pathPattern must be provided');
    });

    test('should reject mapping with neither hostHeaderPattern nor pathPattern', () => {
      const mapping = createValidMapping();
      const result = validateMapping(mapping);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Exactly one of hostHeaderPattern or pathPattern must be provided');
    });

    test('should require mappingId, originId, createdAt', () => {
      const result = validateMapping({});
      expect(result.success).toBe(false);
    });

    test('should reject extra fields', () => {
      const mapping = createValidMapping({ 
        hostHeaderPattern: 'api.example.com',
        extraField: 'not allowed' 
      });
      const result = validateMapping(mapping);
      expect(result.success).toBe(false);
    });
  });

  describe('MappingCreateSchema', () => {
    test('should validate create request with hostHeaderPattern', () => {
      const result = validateMappingCreate({ 
        mappingName: 'Test Mapping',
        originId: validUuid,
        hostHeaderPattern: 'api.example.com'
      });
      expect(result.success).toBe(true);
    });

    test('should validate create request with pathPattern', () => {
      const result = validateMappingCreate({ 
        mappingName: 'Test Mapping',
        originId: validUuid,
        pathPattern: '/api/v1/*'
      });
      expect(result.success).toBe(true);
    });

    test('should reject create request with both patterns', () => {
      const result = validateMappingCreate({ 
        mappingName: 'Test Mapping',
        originId: validUuid,
        hostHeaderPattern: 'api.example.com',
        pathPattern: '/api/v1/*'
      });
      expect(result.success).toBe(false);
    });

    test('should reject create request with neither pattern', () => {
      const result = validateMappingCreate({ 
        mappingName: 'Test Mapping',
        originId: validUuid 
      });
      expect(result.success).toBe(false);
    });

    test('should require originId', () => {
      const result = validateMappingCreate({ 
        mappingName: 'Test Mapping',
        hostHeaderPattern: 'api.example.com' 
      });
      expect(result.success).toBe(false);
    });

    test('should require mappingName', () => {
      const result = validateMappingCreate({ 
        originId: validUuid,
        hostHeaderPattern: 'api.example.com' 
      });
      expect(result.success).toBe(false);
    });
  });

  describe('MappingUpdateSchema', () => {
    test('should reject empty update request', () => {
      const result = validateMappingUpdate({});
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('At least one field must be provided for update, and cannot have both hostHeaderPattern and pathPattern');
    });

    test('should validate update with hostHeaderPattern only', () => {
      const result = validateMappingUpdate({ hostHeaderPattern: '*.example.com' });
      expect(result.success).toBe(true);
    });

    test('should validate update with pathPattern only', () => {
      const result = validateMappingUpdate({ pathPattern: '/new/path/*' });
      expect(result.success).toBe(true);
    });

    test('should validate update with originId only', () => {
      const result = validateMappingUpdate({ originId: validUuid });
      expect(result.success).toBe(true);
    });

    test('should validate update with policyId only', () => {
      const result = validateMappingUpdate({ policyId: validUuid });
      expect(result.success).toBe(true);
    });

    test('should validate update with mappingName only', () => {
      const result = validateMappingUpdate({ mappingName: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    test('should validate update with description only', () => {
      const result = validateMappingUpdate({ description: 'Updated description' });
      expect(result.success).toBe(true);
    });

    test('should reject update with both patterns', () => {
      const result = validateMappingUpdate({ 
        hostHeaderPattern: '*.example.com',
        pathPattern: '/api/*'
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('At least one field must be provided for update, and cannot have both hostHeaderPattern and pathPattern');
    });
  });

});
