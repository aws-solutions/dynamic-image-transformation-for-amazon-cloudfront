// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from 'react';
import { Origin } from '@data-models';

export const useOriginFilters = (origins: Origin[]) => {
  const [filteringText, setFilteringText] = useState('');

  const filteredOrigins = useMemo(() => {
    if (!filteringText) return origins;
    
    const searchTerm = filteringText.toLowerCase();
    return origins.filter(origin =>
      origin.originName?.toLowerCase().includes(searchTerm) ||
      origin.originDomain?.toLowerCase().includes(searchTerm) ||
      origin.originPath?.toLowerCase().includes(searchTerm)
    );
  }, [origins, filteringText]);

  return {
    filteringText,
    setFilteringText,
    filteredOrigins
  };
};
