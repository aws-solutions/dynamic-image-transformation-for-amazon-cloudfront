// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Simplified cache key generation for DIT single-table design.
 * Uses entity IDs directly as cache keys since all entities have unique IDs.
 */

/**
 * Generate cache key from entity ID
 * For most entities, this is just the ID itself
 */
export function getCacheKey(entityId: string): string {
  return entityId;
}

/**
 * Generate cache key for path-based lookups
 * Normalizes path to ensure consistent caching
 */
export function getPathCacheKey(path: string): string {
  return normalizePath(path);
}

/**
 * Normalize path for consistent caching
 */
function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .replace(/\/+/g, '/') // Replace multiple slashes with single slash
    .replace(/\/$/, '') // Remove trailing slash
    .replace(/^\//, ''); // Remove leading slash
}