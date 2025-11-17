// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { 
  validateOriginCreate, 
  validateOriginUpdate,
  validateMappingCreate,
  validateMappingUpdate,
  validateTransformationPolicyCreate,
  validateTransformationPolicyUpdate
} from '@data-models';
import { ZodError } from 'zod';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const formatZodError = (error: ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  if (error.issues && Array.isArray(error.issues)) {
    error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    });
  }
  
  return errors;
};

export const validateOriginCreateData = (data: any): ValidationResult => {
  try {
    const result = validateOriginCreate(data);
    
    if (result.success) {
      return { isValid: true, errors: {} };
    } else {
      const errors = formatZodError(result.error);
      return { isValid: false, errors };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return { isValid: false, errors: formatZodError(error) };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
};

export const validateOriginUpdateData = (data: any): ValidationResult => {
  try {
    validateOriginUpdate(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof ZodError) {
      return { isValid: false, errors: formatZodError(error) };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
};

export const validateMappingCreateData = (data: any): ValidationResult => {
  const result = validateMappingCreate(data);
  if (result.success) {
    return { isValid: true, errors: {} };
  } else {
    return { isValid: false, errors: formatZodError(result.error) };
  }
};

export const validateMappingUpdateData = (data: any): ValidationResult => {
  const result = validateMappingUpdate(data);
  if (result.success) {
    return { isValid: true, errors: {} };
  } else {
    return { isValid: false, errors: formatZodError(result.error) };
  }
};

export const validateTransformationPolicyCreateData = (data: any): ValidationResult => {
  try {
    validateTransformationPolicyCreate(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof ZodError) {
      return { isValid: false, errors: formatZodError(error) };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
};

export const validateTransformationPolicyUpdateData = (data: any): ValidationResult => {
  try {
    validateTransformationPolicyUpdate(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof ZodError) {
      return { isValid: false, errors: formatZodError(error) };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
};