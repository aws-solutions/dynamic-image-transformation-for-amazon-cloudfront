// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Set environment variables BEFORE any imports
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://localhost:8000";

import { TransformationResolverService } from '../../../../src/services/transformation-resolver/transformation-resolver.service';
import { CacheRegistry } from '../../../../src/services/cache/cache-registry';
import { DynamoDBTestSetup } from '../../setup/dynamodb-setup';
import { Request } from 'express';
import { ImageProcessingRequest } from '../../../../src/types/image-processing-request';

describe('TransformationResolverService Integration Tests', () => {
  const testTableName = 'test-transformation-resolver-table';
  let transformationResolver: TransformationResolverService;

  beforeAll(async () => {
    DynamoDBTestSetup.initialize();
    await DynamoDBTestSetup.createTable(testTableName);
  });

  afterAll(async () => {
    await DynamoDBTestSetup.deleteTable(testTableName);
  });

  beforeEach(async () => {
    CacheRegistry.getInstance().clear();
    process.env.DDB_TABLE_NAME = testTableName;
    await DynamoDBTestSetup.clearTable(testTableName);
    jest.clearAllMocks();
    
    await DynamoDBTestSetup.seedTestData(testTableName);
    await initializeCachesForTesting();
    
    transformationResolver = TransformationResolverService.getInstance();
  });

  const createMockRequest = (query: any = {}, headers: any = {}): Request => ({
    query,
    headers,
    get: jest.fn().mockImplementation((header: string) => headers[header.toLowerCase()] || '')
  } as any);

  const createMockImageRequest = (policyId?: string): ImageProcessingRequest => ({
    requestId: 'test-request-id',
    timestamp: Date.now(),
    response: { headers: {} },
    policy: policyId ? { id: policyId } : undefined
  });

  const initializeCachesForTesting = async (): Promise<void> => {
    const { PolicyCache } = await import('../../../../src/services/cache/domain/policy-cache');
    const registry = CacheRegistry.getInstance();
    
    const policyCache = new PolicyCache();
    registry.register('policy', policyCache);
    
    await policyCache.warmCache();
  };

  describe('End-to-End Transformation Resolution', () => {
    test('should resolve URL transformations without policy', async () => {
      const req = createMockRequest({ 'resize.width': 300, format: 'webp' });
      const imageRequest = createMockImageRequest();

      await transformationResolver.resolve(req, imageRequest);

      // 2 URL transformations + 1 from default policy
      expect(imageRequest.transformations).toHaveLength(3);
      expect(imageRequest.transformations!.map(t => t.type)).toContain('resize');
      expect(imageRequest.transformations!.map(t => t.type)).toContain('format');
      expect(imageRequest.transformations!.map(t => t.type)).toContain('quality');
    });

    test('should resolve policy transformations from DynamoDB cache', async () => {
      const req = createMockRequest({ 'resize.width': 300 });
      const imageRequest = createMockImageRequest('test-policy-1');

      await transformationResolver.resolve(req, imageRequest);

      expect(imageRequest.transformations!.length).toBeGreaterThan(1);
      expect(imageRequest.transformations!.map(t => t.type)).toContain('resize');
      expect(imageRequest.transformations!.map(t => t.type)).toContain('quality');
    });

    test('should apply URL precedence over policy transformations', async () => {
      const req = createMockRequest({ 'quality': 95 });
      const imageRequest = createMockImageRequest('test-policy-1');

      await transformationResolver.resolve(req, imageRequest);

      const qualityTransform = imageRequest.transformations!.find(t => t.type === 'quality');
      expect(qualityTransform?.value).toBe(95);
      expect(qualityTransform?.source).toBe('url');
    });

    test('should apply conditional transformations when headers match', async () => {
      const req = createMockRequest(
        { 'resize.width': 300 },
        { 'dit-accept': 'image/webp' }
      );
      const imageRequest = createMockImageRequest('conditional-policy');

      await transformationResolver.resolve(req, imageRequest);

      expect(imageRequest.transformations!.map(t => t.type)).toContain('format');
    });

    test('should exclude conditional transformations when headers do not match', async () => {
      const req = createMockRequest(
        { 'resize.width': 300 },
        { 'dit-accept': 'image/jpeg' }
      );
      const imageRequest = createMockImageRequest('conditional-policy');

      await transformationResolver.resolve(req, imageRequest);

      expect(imageRequest.transformations!.map(t => t.type)).not.toContain('format');
      expect(imageRequest.transformations!.map(t => t.type)).toContain('resize');
    });
  });

  describe('Policy Cache Integration', () => {
    test('should throw an error when an explicit policyId is not found', async () => {
      const req = createMockRequest({ 'resize.width': 300 });
      const imageRequest = createMockImageRequest('nonexistent-policy');

      await expect(transformationResolver.resolve(req, imageRequest))
        .rejects.toThrow();
    });

    test('should apply default policy when no specific policy provided', async () => {
      const req = createMockRequest({ 'resize.width': 300 });
      const imageRequest = createMockImageRequest();

      await transformationResolver.resolve(req, imageRequest);

      expect(imageRequest.transformations!.length).toBeGreaterThan(1);
      expect(imageRequest.transformations!.map(t => t.type)).toContain('resize');
      expect(imageRequest.transformations!.map(t => t.type)).toContain('quality');
      const qualityTransform = imageRequest.transformations!.find(t => t.type === 'quality');
      expect(qualityTransform?.value).toBe(75);
    });
  });

  describe('Concurrent Resolution', () => {
    test('should handle concurrent transformation requests', async () => {
      const requests = [
        { req: createMockRequest({ 'resize.width': 300 }), img: createMockImageRequest('test-policy-1') },
        { req: createMockRequest({ 'resize.height': 200 }), img: createMockImageRequest('test-policy-2') },
        { req: createMockRequest({ 'format': 'webp' }), img: createMockImageRequest() }
      ];

      await Promise.all(
        requests.map(({ req, img }) => transformationResolver.resolve(req, img))
      );

      requests.forEach(({ img }) => {
        expect(img.transformations).toBeDefined();
      });
    });
  });

  describe('Transformation Limits Integration', () => {
    test('should enforce transformation limits with large policy sets', async () => {
      const req = createMockRequest({
        'resize.width': 300,
        'resize.height': 200,
        'format': 'webp',
        'quality': 80,
        'rotate': 90
      });
      const imageRequest = createMockImageRequest('large-policy');

      await transformationResolver.resolve(req, imageRequest);

      expect(imageRequest.transformations!.length).toBeLessThanOrEqual(10);
    });
  });
});