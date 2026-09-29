// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Transformation } from '../../../types/transformation';
import { ContentModerationConfig, resolveModerationConfig } from '../../content-moderation/content-moderation-config';

const MAX_TRANSFORMATIONS = parseInt(process.env.MAX_TRANSFORMATIONS || '10');

const CONTENT_MODERATION_TYPE = 'contentModeration';

// Merge policy + URL moderation so a URL can only tighten it, never weaken it, and only for
// fields the URL actually set — injected defaults must not mutate a field the URL never sent.
function mergeModerationTightenOnly(
  policyValue: true | Partial<ContentModerationConfig>,
  urlValue: true | Partial<ContentModerationConfig>,
): ContentModerationConfig {
  const policy = resolveModerationConfig(policyValue);
  const url: Partial<ContentModerationConfig> = urlValue === true ? {} : urlValue;

  return {
    // URL may only lower minConfidence (stricter); absent keeps policy.
    minConfidence: url.minConfidence !== undefined ? Math.min(policy.minConfidence, url.minConfidence) : policy.minConfidence,
    // URL may only raise blur (stronger); absent keeps policy.
    blur: url.blur !== undefined ? Math.max(policy.blur, url.blur) : policy.blur,
    // flag-all ([]) is strictest and can't be narrowed; else union; absent keeps policy.
    moderationLabels: policy.moderationLabels.length === 0
      ? []
      : url.moderationLabels !== undefined
        ? Array.from(new Set([...policy.moderationLabels, ...url.moderationLabels]))
        : policy.moderationLabels,
  };
}

export function applyPrecedence(urlTransformations: Transformation[], policyTransformations: Transformation[]): Transformation[] {
  const result: Transformation[] = [];
  const typeToIndex = new Map<string, number>();

  // Apply policy transformations first
  for (const transformation of policyTransformations) {
    result.push({ ...transformation });
    typeToIndex.set(transformation.type, result.length - 1);
  }

  // Apply URL transformations (override existing or add new)
  for (const transformation of urlTransformations) {
    const existingIndex = typeToIndex.get(transformation.type);
    if (existingIndex !== undefined) {
      if (transformation.type === CONTENT_MODERATION_TYPE) {
        // Tighten-only so a URL (e.g. minConfidence=100) can't disable policy moderation.
        const merged = mergeModerationTightenOnly(result[existingIndex].value, transformation.value);
        result[existingIndex] = { ...transformation, value: merged, source: 'url' as const };
      } else {
        // Override existing policy transformation
        result[existingIndex] = { ...transformation, source: 'url' as const };
      }
    } else {
      // Add new transformation type (adding moderation where policy had none is safe)
      result.push({ ...transformation, source: 'url' as const });
    }
  }

  return result;
}

export function enforceLimits(transformations: Transformation[]): Transformation[] {
  if (transformations.length <= MAX_TRANSFORMATIONS) {
    return transformations;
  }
  
  logTransformationLimitExceeded(transformations, MAX_TRANSFORMATIONS);
  
  // Take first N transformations in arrival order
  return transformations.slice(0, MAX_TRANSFORMATIONS);
}

function logTransformationLimitExceeded(transformations: Transformation[], limit: number): void {
  const droppedTransformations = transformations.slice(limit);
  
  console.warn(`Transformation limit of ${limit} exceeded`, {
    totalTransformations: transformations.length,
    droppedCount: droppedTransformations.length,
    transformationTypes: transformations.map(t => t.type),
    sources: transformations.map(t => t.source),
    droppedTransformations: droppedTransformations.map(t => ({
      type: t.type,
      source: t.source
    }))
  });
}