// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Set environment variables BEFORE any imports
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://localhost:8000";

import { InitializationService } from '../../../../src/services/initialization/initialization-service';
import { InitializationState } from '../../../../src/services/initialization/types';
import { CacheRegistry } from '../../../../src/services/cache/cache-registry';
import { PolicyCache } from '../../../../src/services/cache/domain/policy-cache';
import { OriginCache } from '../../../../src/services/cache/domain/origin-cache';
import { PathMappingCache } from '../../../../src/services/cache/domain/path-mapping-cache';
import { HeaderMappingCache } from '../../../../src/services/cache/domain/header-mapping-cache';
import { DynamoDBTestSetup } from '../../setup/dynamodb-setup';
import { CacheAssertions } from '../../helpers/cache-assertions';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ddbDriver } from '../../../../src/services/database';

describe('InitializationService Integration Tests', () => {
  const testTableName = 'test-dit-table';

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
  });

  describe('Cache Initialization and Population', () => {
    test('should initialize all 4 domain caches and populate them with DDB data', async () => {
      await DynamoDBTestSetup.seedTestData(testTableName);

      const state: InitializationState = {
        status: 'UNKNOWN',
        completedCaches: [],
        startTime: new Date()
      };

      await InitializationService.initialize(state);

      expect(state.status).toBe('HEALTHY');
      expect(state.completedCaches).toHaveLength(4);
      expect(state.completedCaches).toEqual([
        'Policy Cache',
        'Origin Cache',
        'Path Mapping Cache',
        'Header Mapping Cache'
      ]);

      const registry = CacheRegistry.getInstance();
      
      // Verify all caches are registered
      expect(registry.get('policy')).toBeDefined();
      expect(registry.get('origin')).toBeDefined();
      expect(registry.get('pathMapping')).toBeDefined();
      expect(registry.get('headerMapping')).toBeDefined();

      // Verify caches are populated with correct data
      const policyCache = registry.get('policy') as PolicyCache;
      const originCache = registry.get('origin') as OriginCache;
      const pathMappingCache = registry.get('pathMapping') as PathMappingCache;
      const headerMappingCache = registry.get('headerMapping') as HeaderMappingCache;

      await CacheAssertions.verifyPolicyCachePopulated(policyCache);
      await CacheAssertions.verifyOriginCachePopulated(originCache);
      await CacheAssertions.verifyPathMappingCachePopulated(pathMappingCache);
      await CacheAssertions.verifyHeaderMappingCachePopulated(headerMappingCache);
    });

    test('should handle empty tables gracefully', async () => {
      // Table is already cleared in beforeEach

      const state: InitializationState = {
        status: 'INITIALIZING',
        completedCaches: [],
        startTime: new Date()
      };

      await InitializationService.initialize(state);

      expect(state.status).toBe('HEALTHY');
      expect(state.completedCaches).toHaveLength(4);

      const registry = CacheRegistry.getInstance();
      
      // Verify caches exist but are empty
      const policyCache = registry.get('policy') as PolicyCache;
      const originCache = registry.get('origin') as OriginCache;
      const pathMappingCache = registry.get('pathMapping') as PathMappingCache;
      const headerMappingCache = registry.get('headerMapping') as HeaderMappingCache;

      await CacheAssertions.verifyCachesEmpty(policyCache, originCache, pathMappingCache, headerMappingCache);
    });
  });

  describe('Error Handling', () => {
    test('should fail gracefully when DDB table does not exist', async () => {
      // Reset singleton to force recreation with new table name
      ddbDriver.reset();
      process.env.DDB_TABLE_NAME = 'non-existent-table';

      const state: InitializationState = {
        status: 'INITIALIZING',
        completedCaches: [],
        startTime: new Date()
      };

      // Suppress console output for this error test
      const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(InitializationService.initialize(state)).rejects.toThrow('process.exit called');

      expect(state.status).toBe('UNHEALTHY');
      expect(state.error).toBeDefined();

      mockConsoleWarn.mockRestore();
      mockConsoleLog.mockRestore();
      mockConsoleError.mockRestore();
      mockExit.mockRestore();
    });
  });
});