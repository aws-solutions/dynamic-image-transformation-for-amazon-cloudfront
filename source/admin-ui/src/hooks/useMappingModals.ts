// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback } from 'react';
import { Mapping } from '@data-models';

export const useMappingModals = () => {
  const [deletingMapping, setDeletingMapping] = useState<Mapping | null>(null);
  const showDeleteModal = deletingMapping !== null;

  const openDeleteModal = useCallback((mapping: Mapping) => {
    setDeletingMapping(mapping);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeletingMapping(null);
  }, []);

  return {
    showDeleteModal,
    deletingMapping,
    openDeleteModal,
    closeDeleteModal
  };
};
