// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from 'react';
import { Mapping } from '@data-models';

export const useMappingFilters = (mappings: Mapping[]) => {
  const [filteringText, setFilteringText] = useState('');

  const filteredMappings = useMemo(() => {
    if (!filteringText) return mappings;
    
    const searchTerm = filteringText.toLowerCase();
    return mappings.filter(mapping => 
      mapping.mappingName?.toLowerCase().includes(searchTerm) ||
      mapping.description?.toLowerCase().includes(searchTerm) ||
      mapping.hostHeaderPattern?.toLowerCase().includes(searchTerm) ||
      mapping.pathPattern?.toLowerCase().includes(searchTerm)
    );
  }, [mappings, filteringText]);

  return {
    filteringText,
    setFilteringText,
    filteredMappings
  };
};
