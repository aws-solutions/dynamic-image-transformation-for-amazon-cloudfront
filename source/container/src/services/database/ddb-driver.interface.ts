// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PathMapping } from '../cache/domain/path-mapping-cache';
import { HeaderMapping } from '../cache/domain/header-mapping-cache';
import { OriginConfiguration } from '../cache/domain/origin-cache';
import { TransformationPolicyRecord } from './types';

/**
 * DynamoDB Driver Interface
 * Pure Data Access Layer for DIT entity operations
 */
export interface DDBDriver {
  // Bulk operations for cache warming
  getAllPathMappings(): Promise<PathMapping[]>;
  getAllHeaderMappings(): Promise<HeaderMapping[]>;
  getAllOrigins(): Promise<OriginConfiguration[]>;
  getAllPolicies(): Promise<TransformationPolicyRecord[]>;
}