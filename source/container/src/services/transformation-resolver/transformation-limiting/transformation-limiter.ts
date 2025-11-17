// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Transformation } from '../../../types/transformation';

const MAX_TRANSFORMATIONS = parseInt(process.env.MAX_TRANSFORMATIONS || '10');

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
      // Override existing policy transformation
      result[existingIndex] = { ...transformation, source: 'url' as const };
    } else {
      // Add new transformation type
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