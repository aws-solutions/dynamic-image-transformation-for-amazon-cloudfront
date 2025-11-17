// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface CacheConfig {
  name: string;
}

export interface TrieCacheConfig extends CacheConfig {
  maxDepth: number;
  
  pathSeparator: string;
  
  /** Whether to allow prefix matching (true) or require exact/wildcard matches only (false) */
  allowPrefixMatching: boolean;
}

export const POLICY_CACHE_CONFIG: CacheConfig = {
  name: 'transformation-policies'
};

export const ORIGIN_CACHE_CONFIG: CacheConfig = {
  name: 'origins'
};

export const HEADER_MAPPING_CACHE_CONFIG: TrieCacheConfig = {
  name: 'header-mappings',
  maxDepth: 10,
  pathSeparator: '.',
  allowPrefixMatching: false  // Exact/wildcard only for security
};

export const PATH_MAPPING_CACHE_CONFIG: TrieCacheConfig = {
  name: 'path-mappings',
  maxDepth: 10,
  pathSeparator: '/',
  allowPrefixMatching: true   // Allow prefix matching for paths
};
