// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback } from 'react';
import { OriginCreate, validateOriginCreate } from '@data-models';
import { OriginService } from '../services/originService';

interface HeaderEntry {
  id: string;
  name: string;
  value: string;
}

export const useOriginForm = (initialData?: OriginCreate) => {
  const [formData, setFormData] = useState<OriginCreate>(initialData || {
    originName: '',
    originDomain: '',
    originHeaders: {}
  });

  // Convert headers object to array with stable IDs for better React rendering
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>(() => {
    const headers = initialData?.originHeaders || {};
    return Object.entries(headers).map(([name, value], index) => ({
      id: `header-${index}`,
      name,
      value
    }));
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Sync headerEntries back to formData.originHeaders
  const syncHeadersToFormData = useCallback((entries: HeaderEntry[]) => {
    const headers: Record<string, string> = {};
    entries.forEach(entry => {
      if (entry.name.trim()) {
        headers[entry.name] = entry.value;
      }
    });
    setFormData(prev => ({ ...prev, originHeaders: headers }));
  }, []);

  const validateForm = (): boolean => {
    const result = validateOriginCreate(formData);
    
    if (result.success) {
      setErrors({});
      return true;
    }
    
    const newErrors: Record<string, string> = {};
    result.error.issues.forEach(issue => {
      const path = issue.path.join('.');
      newErrors[path] = issue.message;
    });
    setErrors(newErrors);
    return false;
  };

  const updateField = (field: keyof OriginCreate, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addCustomHeader = () => {
    const newEntry: HeaderEntry = {
      id: `header-${Date.now()}`,
      name: '',
      value: ''
    };
    const newEntries = [...headerEntries, newEntry];
    setHeaderEntries(newEntries);
    syncHeadersToFormData(newEntries);
  };

  const removeCustomHeader = (headerId: string) => {
    const newEntries = headerEntries.filter(entry => entry.id !== headerId);
    setHeaderEntries(newEntries);
    syncHeadersToFormData(newEntries);
  };

  const updateCustomHeader = (headerId: string, field: 'name' | 'value', newValue: string) => {
    const newEntries = headerEntries.map(entry => 
      entry.id === headerId 
        ? { ...entry, [field]: newValue }
        : entry
    );
    setHeaderEntries(newEntries);
    syncHeadersToFormData(newEntries);
  };

  const submitForm = async (isEditing: boolean, id?: string) => {
    if (!validateForm()) {
      return { success: false, error: 'Please fix validation errors' };
    }

    setLoading(true);
    try {
      const result = isEditing 
        ? await OriginService.updateOrigin(id!, formData)
        : await OriginService.createOrigin(formData);
      
      return result;
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    headerEntries,
    errors,
    loading,
    updateField,
    addCustomHeader,
    removeCustomHeader,
    updateCustomHeader,
    submitForm,
    setFormData: (data: OriginCreate) => {
      setFormData(data);
      // Update headerEntries when formData is set externally
      const headers = data.originHeaders || {};
      const entries = Object.entries(headers).map(([name, value], index) => ({
        id: `header-${index}`,
        name,
        value
      }));
      setHeaderEntries(entries);
    }
  };
};