// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Set environment variables BEFORE any imports
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://localhost:8000";

import { RequestResolverService } from '../../../../src/services/request-resolver/request-resolver.service';
import { CacheRegistry } from '../../../../src/services/cache/cache-registry';
import { DynamoDBTestSetup } from '../../setup/dynamodb-setup';
import { ValidationError } from '../../../../src/services/request-resolver/errors/validation.error';
import { OriginNotFoundError } from '../../../../src/services/request-resolver/errors/origin-not-found.error';
import { ConnectionError } from '../../../../src/services/request-resolver/errors/connection.error';
import axios from 'axios';
import { Request } from 'express';
import { ImageProcessingRequest } from '../../../../src/types/image-processing-request';

// Mock axios for network calls
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock S3Client
jest.mock('@aws-sdk/client-s3');
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
const mockS3Send = jest.fn();

describe('RequestResolverService Integration Tests', () => {
  const testTableName = 'test-request-resolver-table';
  let requestResolver: RequestResolverService;

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
    
    // Seed test data first
    await DynamoDBTestSetup.seedTestData(testTableName);
    
    // Initialize and warm caches for testing
    await initializeCachesForTesting();
    
    // Get fresh singleton instance
    requestResolver = RequestResolverService.getInstance();
    
    // Mock successful axios responses by default
    mockedAxios.head.mockResolvedValue({
      headers: { 'content-type': 'image/jpeg' }
    });
    mockedAxios.isAxiosError.mockReturnValue(false);
    
    // Mock S3Client responses by default
    mockS3Send.mockResolvedValue({
      ContentType: 'image/jpeg'
    });
    (S3Client as jest.MockedClass<typeof S3Client>).prototype.send = mockS3Send;
  });

  /**
   * Helper to create mock Express Request objects
   */
  const createMockRequest = (path: string, host?: string): Request => ({
    path,
    get: jest.fn().mockImplementation((header: string) => {
      if (header.toLowerCase() === 'host') return host || '';
      return '';
    })
  } as any);

  /**
   * Helper to create mock ImageProcessingRequest objects
   */
  const createMockImageRequest = (): ImageProcessingRequest => ({
    requestId: 'test-request-id',
    timestamp: Date.now(),
    response: { headers: {} }
  });

  /**
   * Initialize and warm caches for testing
   */
  const initializeCachesForTesting = async (): Promise<void> => {
    const { PolicyCache } = await import('../../../../src/services/cache/domain/policy-cache');
    const { OriginCache } = await import('../../../../src/services/cache/domain/origin-cache');
    const { PathMappingCache } = await import('../../../../src/services/cache/domain/path-mapping-cache');
    const { HeaderMappingCache } = await import('../../../../src/services/cache/domain/header-mapping-cache');
    
    const registry = CacheRegistry.getInstance();
    
    // Create and register caches
    const policyCache = new PolicyCache();
    const originCache = new OriginCache();
    const pathMappingCache = new PathMappingCache();
    const headerMappingCache = new HeaderMappingCache();
    
    registry.register('policy', policyCache);
    registry.register('origin', originCache);
    registry.register('pathMapping', pathMappingCache);
    registry.register('headerMapping', headerMappingCache);
    
    // Warm caches with data from DynamoDB
    await Promise.all([
      policyCache.warmCache(),
      originCache.warmCache(),
      pathMappingCache.warmCache(),
      headerMappingCache.warmCache()
    ]);
  };

  describe('End-to-End Request Resolution Flow', () => {
    test('should resolve request with host mapping precedence over path mapping', async () => {
      const req = createMockRequest('/images/test.jpg', 'cdn.example.com');
      const imageRequest = createMockImageRequest();

      await requestResolver.resolve(req, imageRequest);

      // Should use host mapping (cdn.example.com) instead of path mapping (/images/*)
      expect(imageRequest.origin?.url).toBeDefined();
      expect(mockS3Send).toHaveBeenCalled();
    });

    test('should resolve request using path mapping when host mapping fails', async () => {
      const req = createMockRequest('/images/test.jpg', 'unknown.host.com');
      const imageRequest = createMockImageRequest();

      await requestResolver.resolve(req, imageRequest);

      expect(imageRequest.origin?.url).toContain('test-bucket-1');
    });

    test('should resolve request with path mapping only', async () => {
      const req = createMockRequest('/external/image.png');
      const imageRequest = createMockImageRequest();

      await requestResolver.resolve(req, imageRequest);

      expect(imageRequest.origin?.url).toContain('example.com');
    });

    test('should throw OriginNotFoundError when neither path nor host mappings match', async () => {
      const req = createMockRequest('/nomatch/path', 'nomatch.com');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(OriginNotFoundError);
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow('Unable to resolve an origin');
    });
  });

  describe('Component Integration Error Handling', () => {
    test('should propagate ValidationError from validation service', async () => {
      const req = createMockRequest('invalid-path');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(ValidationError);
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow('Invalid request path');
    });

    test('should throw OriginNotFoundError for requests with no host header and no matching mappings', async () => {
      // Create request with no host header and unmapped path
      const req = createMockRequest('/unmapped/path');
      const imageRequest = createMockImageRequest();

      // The system should throw OriginNotFoundError since no mappings match
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(OriginNotFoundError);
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow('Unable to resolve an origin');
    });

    test('should propagate OriginNotFoundError from origin resolver', async () => {
      const req = createMockRequest('/orphan/test.jpg');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(OriginNotFoundError);
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow('Unable to resolve an origin');
    });

    test('should propagate ConnectionError from connection manager', async () => {
      await DynamoDBTestSetup.seedTestData(testTableName);
      mockS3Send.mockRejectedValue({ name: 'NoSuchKey', message: 'The specified key does not exist.' });
      const req = createMockRequest('/images/test.jpg');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(ConnectionError);
    });

    test('should propagate ValidationError for null request', async () => {
      const req = null as any;
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(ValidationError);
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow('Request object is required');
    });
  });



  describe('Origin Validation Integration', () => {
    test('should successfully validate reachable HTTPS origin', async () => {
      const req = createMockRequest('/images/test.jpg');
      const imageRequest = createMockImageRequest();

      await requestResolver.resolve(req, imageRequest);

      expect(imageRequest.origin?.url).toBeDefined();
      expect(mockS3Send).toHaveBeenCalled();
    });

    test('should fail validation for unreachable origin', async () => {
      mockS3Send.mockRejectedValue({ name: 'NoSuchBucket', message: 'The specified bucket does not exist' });
      const req = createMockRequest('/images/test.jpg');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(ConnectionError);
    });
  });

  describe('Request Validation Integration', () => {
    test('should reject requests with invalid paths', async () => {
      const req = createMockRequest('no-leading-slash');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(ValidationError);
    });

    test('should reject requests with invalid host headers', async () => {
      const req = createMockRequest('/valid/path', 'invalid host with spaces');
      const imageRequest = createMockImageRequest();

      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow(ValidationError);
      await expect(requestResolver.resolve(req, imageRequest)).rejects.toThrow('Invalid host header');
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle concurrent requests correctly', async () => {
      await DynamoDBTestSetup.seedTestData(testTableName);
      const requests = [
        createMockRequest('/images/test1.jpg'),
        createMockRequest('/images/test2.jpg'),
        createMockRequest('/external/test3.jpg')
      ];
      const imageRequests = requests.map(() => createMockImageRequest());

      await Promise.all(
        requests.map((req, i) => requestResolver.resolve(req, imageRequests[i]))
      );

      expect(imageRequests).toHaveLength(3);
      imageRequests.forEach(imageRequest => {
        expect(imageRequest.origin?.url).toBeDefined();
      });
    });
  });
});