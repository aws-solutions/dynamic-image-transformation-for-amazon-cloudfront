// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo, useEffect } from 'react';
import { Origin } from '@data-models';

export const useOriginPagination = (origins: Origin[], pageSize = 10) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  // Reset to page 1 when origins change
  useEffect(() => {
    setCurrentPageIndex(1);
  }, [origins]);

  const paginatedOrigins = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * pageSize;
    return origins.slice(startIndex, startIndex + pageSize);
  }, [origins, currentPageIndex, pageSize]);

  const totalPages = Math.ceil(origins.length / pageSize);

  return {
    currentPageIndex,
    setCurrentPageIndex,
    paginatedOrigins,
    totalPages
  };
};
