// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { Transformation } from '../../../types/transformation';
import { transformationSchemas } from '@dit/data-models';
import { transformationParsers } from './transformation-parsers';

export function extractUrlTransformations(req: Request, requestId: string): Transformation[] {
  try {
    const queryParams = req.query;
    const transformations: Transformation[] = [];
    
    // Group parameters by transformation type using dot-notation
    const transformationGroups: Record<string, any> = {};
    
    for (const [param, value] of Object.entries(queryParams)) {
      const [baseKey, subKey] = param.split('.', 2);
      const transformationType = subKey ? baseKey : param;
            
      if (!transformationGroups[transformationType]) {
        transformationGroups[transformationType] = {};
      }
      
      if (subKey) {
        // If the group is a primitive (e.g., smartCrop=true), override it with an object
        // This allows parameterized mode to take precedence over boolean mode
        if (typeof transformationGroups[transformationType] !== 'object' || transformationGroups[transformationType] === null) {
          transformationGroups[transformationType] = {};
        }
        transformationGroups[transformationType][subKey] = value;
      } else {
        // Only set primitive value if the group isn't already an object with parameters
        if (typeof transformationGroups[transformationType] !== 'object' || Object.keys(transformationGroups[transformationType]).length === 0) {
          transformationGroups[transformationType] = value;
        }
      }      
    }
    // Process each transformation type
    for (const [transformationType, transformationParams] of Object.entries(transformationGroups)) {      
      const parser = transformationParsers[transformationType as keyof typeof transformationParsers];
      const schema = transformationSchemas[transformationType as keyof typeof transformationSchemas];
            
      if (parser && schema) {
        const parsedValue = parser(transformationParams);        
        if (parsedValue !== null && parsedValue !== undefined) {
          const validation = schema.safeParse(parsedValue);
          
          if (validation.success) {
            transformations.push({
              type: transformationType,
              value: validation.data,
              source: 'url'
            });
          } else {
            console.warn(`Invalid ${transformationType} transformation:`, validation.error.issues);
          }
        }
      }
    }
    
    console.log(JSON.stringify({
      requestId,
      component: 'TransformationExtractor',
      operation: 'url_transformations_extracted',
      transformationCount: transformations.length,
      transformationTypes: transformations.map(t => t.type)
    }));
    
    return transformations;
  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      component: 'TransformationExtractor',
      operation: 'url_transformations_extraction_failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));
    throw error;
  }
}