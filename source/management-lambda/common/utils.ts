// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { marshallOptions } from "@aws-sdk/lib-dynamodb";
import { randomUUID as uuidv4 } from "node:crypto";

/**
 * Generates a unique ID for the resource
 */
export function generateId(): string {
  return uuidv4();
}

const _marshallOptions: marshallOptions = {
  /**
   * Whether to remove undefined values from JS arrays/Sets/objects
   * when marshalling to DynamoDB lists/sets/maps respectively.
   */
  removeUndefinedValues: true,
};

export const translateConfig = { marshallOptions: _marshallOptions };

/**
 * Applies a simplified (non-recursive) merge patch to an existing entity.
 * null → delete field, undefined → no change, value → update field.
 * Nested objects are replaced entirely, not deep-merged.
 *
 * @returns A new object with the patch applied (does not mutate inputs)
 */
export function applyMergePatch<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown>
): T {
  const result = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Placeholder substituted for origin header values on any path that leaves this service.
 * originHeaders is the designated store for upstream authentication credentials, so the values are
 * write-only: accepted on create/update, never returned and never logged.
 */
export const REDACTED_HEADER_VALUE = "***REDACTED***";

/**
 * Replaces every origin header value with {@link REDACTED_HEADER_VALUE}, preserving the header
 * names so callers can still see which headers are configured (and count them).
 *
 * Applied at the service boundary and at log statements — NOT in the DAO. `convertFromDB` must keep
 * returning real values because `BaseService.buildUpdatedEntity` reads the existing entity through
 * it and merges the patch over it; redacting there would write the placeholder back over the stored
 * credential whenever an update did not include originHeaders.
 *
 * @returns A new object with header values redacted (does not mutate the input)
 */
export function redactOriginHeaders<T extends Record<string, unknown>>(entity: T): T {
  const headers = entity.originHeaders;
  if (!headers || typeof headers !== "object") return entity;

  const redacted = Object.fromEntries(Object.keys(headers).map((name) => [name, REDACTED_HEADER_VALUE]));
  return { ...entity, originHeaders: redacted };
}
