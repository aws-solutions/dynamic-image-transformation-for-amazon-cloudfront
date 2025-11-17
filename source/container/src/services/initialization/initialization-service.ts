// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InitializationState, CacheInitializer } from './types';
import { PolicyCache } from '../cache/domain/policy-cache';
import { OriginCache } from '../cache/domain/origin-cache';
import { PathMappingCache } from '../cache/domain/path-mapping-cache';
import { HeaderMappingCache } from '../cache/domain/header-mapping-cache';
import { CacheRegistry } from '../cache/cache-registry';

export class InitializationService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

  static async initialize(state: InitializationState): Promise<void> {
    console.log('Starting container initialization...');
    
    state.status = 'INITIALIZING';
    state.startTime = new Date();

    const registry = CacheRegistry.getInstance();

    const cacheInitializers: CacheInitializer[] = [
      {
        name: 'Policy Cache',
        initialize: async () => {
          const policyCache = new PolicyCache();
          await policyCache.warmCache();
          registry.register('policy', policyCache);
        }
      },
      {
        name: 'Origin Cache', 
        initialize: async () => {
          const originCache = new OriginCache();
          await originCache.warmCache();
          registry.register('origin', originCache);
        }
      },
      {
        name: 'Path Mapping Cache',
        initialize: async () => {
          const pathMappingCache = new PathMappingCache();
          await pathMappingCache.warmCache();
          registry.register('pathMapping', pathMappingCache);
        }
      },
      {
        name: 'Header Mapping Cache',
        initialize: async () => {
          const headerMappingCache = new HeaderMappingCache();
          await headerMappingCache.warmCache();
          registry.register('headerMapping', headerMappingCache);
        }
      }
    ];

    try {
      for (const cacheInitializer of cacheInitializers) {
        state.currentStep = `Initializing ${cacheInitializer.name}`;
        console.log(`Initializing ${cacheInitializer.name}...`);

        await this.initializeCacheWithRetry(cacheInitializer);
        
        state.completedCaches.push(cacheInitializer.name);
        console.log(`✓ ${cacheInitializer.name} initialized successfully`);
      }

      state.status = 'HEALTHY';
      state.completionTime = new Date();
      state.currentStep = undefined;
      
      const duration = state.completionTime.getTime() - state.startTime.getTime();
      console.log(`✓ Container initialization completed successfully in ${duration}ms`);
      
    } catch (error) {
      const initError = error as Error;
      console.error('Container initialization failed:', initError.message);
      console.error('Stack trace:', initError.stack);
      
      state.status = 'UNHEALTHY';
      state.error = initError;
      
      // Shutdown container on initialization failure
      console.error('Shutting down container due to initialization failure');
      process.exit(1);
    }
  }

  private static async initializeCacheWithRetry(cacheInitializer: CacheInitializer): Promise<void> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await cacheInitializer.initialize();
        return; // Success - exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.warn(`${cacheInitializer.name} initialization attempt ${attempt}/${this.MAX_RETRIES} failed:`, lastError.message);

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAYS[attempt - 1];
          console.log(`Retrying ${cacheInitializer.name} in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw new Error(`Failed to initialize ${cacheInitializer.name} after ${this.MAX_RETRIES} attempts. Last error: ${lastError!.message}`);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}