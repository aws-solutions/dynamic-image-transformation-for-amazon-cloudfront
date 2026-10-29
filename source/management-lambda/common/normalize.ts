// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Comparison-only normalizers for the uniqueness check; stored values keep the caller's casing.

export const normalizeName = (name: string): string => name.toLowerCase();

export const normalizeHostPattern = (pattern: string): string => pattern.toLowerCase();

// Mirrors the container's path cache key (getPathCacheKey): case, repeated slashes and a leading or trailing slash
// do not distinguish two patterns. Host patterns are case-insensitive here because DNS names are, even though the
// container's host key keeps the stored casing.
export const normalizePathPattern = (pattern: string): string =>
  pattern.toLowerCase().replace(/\/+/g, "/").replace(/\/$/, "").replace(/^\//, "");
