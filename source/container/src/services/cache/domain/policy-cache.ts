// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CacheManager } from '../interfaces/cache-manager';
import { KeyValueCache } from '../implementations/key-value-cache';
import { POLICY_CACHE_CONFIG } from '../config/cache-defaults';
import { getCacheKey } from '../utils/simplified-cache-key';
import { DDBDriver } from '../../database/ddb-driver.interface';
import { ddbDriver } from '../../database';
import { TransformationPolicy } from '../../../types/transformation';
import { TransformationPolicyRecord } from '../../database/types';

/**
 * Transformation policy cache manager with transparent DynamoDB fallback.
 * Handles caching of image transformation policies from DynamoDB.
 */
export class PolicyCache {
  private cache: CacheManager<TransformationPolicy>;
  private ddbDriver: DDBDriver;
  private defaultPolicy: TransformationPolicy | null = null;

  constructor() {
    this.cache = new KeyValueCache<TransformationPolicy>(POLICY_CACHE_CONFIG);
    this.ddbDriver = ddbDriver.instance;
  }

  async getPolicy(policyId: string): Promise<TransformationPolicy | null> {
    const cacheKey = getCacheKey(policyId);
    return await this.cache.get(cacheKey);
  }

  async cachePolicy(policy: TransformationPolicy): Promise<void> {
    const cacheKey = getCacheKey(policy.policyId);
    await this.cache.set(cacheKey, policy);
  }

  async invalidatePolicy(policyId: string): Promise<void> {
    const cacheKey = getCacheKey(policyId);
    await this.cache.delete(cacheKey);
  }

  async getContents(): Promise<TransformationPolicy[]> {
    return await this.cache.getAll();
  }

  async size(): Promise<number> {
    return await this.cache.size();
  }

  async warmCache(): Promise<void> {
    const policyRecords = await this.ddbDriver.getAllPolicies();
    for (const record of policyRecords) {
      const parsedPolicy = this.parsePolicy(record);
      if (parsedPolicy) {
        await this.cachePolicy(parsedPolicy);
        if (parsedPolicy.isDefault) {
          this.defaultPolicy = parsedPolicy;
        }
      }
    }
  }

  getDefault(): TransformationPolicy | null {
    return this.defaultPolicy;
  }

  private parsePolicy(record: TransformationPolicyRecord): TransformationPolicy | null {
    try {
      const parsed = JSON.parse(record.policyJSON);
      return {
        policyId: record.policyId,
        policyName: record.policyName,
        description: record.description,
        transformations: (parsed.transformations || []).map((t: any) => {
          const conditional = t.condition
          return {
            type: t.transformation,
            value: t.value,
            source: 'policy' as const,
            ...(conditional && {
              conditional: {
                target: conditional.field,
                operator: Array.isArray(conditional.value) ? 'isIn' as const : 'equals' as const,
                value: conditional.value
              }
            })
          };
        }),
        outputs: parsed.outputs || [],
        isDefault: record.isDefault
      };
    } catch (error) {
      console.warn(`Failed to parse policy JSON for ${record.policyId}:`, error);
      return null;
    }
  }
}
