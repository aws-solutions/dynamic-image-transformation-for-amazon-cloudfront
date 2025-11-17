// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { Transformation, TransformationConditional } from '../../../types/transformation';

export function evaluateConditionals(transformations: Transformation[], req: Request): Transformation[] {
  return transformations.filter(transformation => {
    if (!transformation.conditional) return true;
    
    try {
      return evaluateCondition(transformation.conditional, req);
    } catch (error) {
      console.warn(`Conditional evaluation failed for transformation:`, transformation, error);
      return false;
    }
  });
}

function evaluateCondition(conditional: TransformationConditional, req: Request): boolean {
  const targetValue = req.get(conditional.target);
  console.log(`Evaluating: `, conditional, "AGAINST", targetValue);
  
  switch (conditional.operator) {
    case 'equals':
      return evaluateEquals(targetValue, conditional.value);
    case 'isIn':
      return evaluateIsIn(targetValue, conditional.value);
    default:
      console.warn(`Unsupported conditional operator: ${conditional.operator}`);
      return false;
  }
}

function evaluateEquals(targetValue: string | undefined, expectedValue: string | string[]): boolean {
  if (!targetValue) return false;
  
  if (Array.isArray(expectedValue)) {
    return expectedValue.some(val => val === targetValue);
  }
  
  console.log("Conditional is: ", expectedValue === targetValue);
  return expectedValue === targetValue;
}

function evaluateIsIn(targetValue: string | undefined, expectedValues: string | string[]): boolean {
  if (!targetValue) return false;
  
  const values = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
  
  return values.some(val => val === targetValue);
}