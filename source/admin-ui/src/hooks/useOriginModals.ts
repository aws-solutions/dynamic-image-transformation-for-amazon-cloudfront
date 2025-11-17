// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback } from 'react';
import { Origin } from '@data-models';

export const useOriginModals = () => {
  const [deletingOrigin, setDeletingOrigin] = useState<Origin | null>(null);
  const showDeleteModal = deletingOrigin !== null;

  const openDeleteModal = useCallback((origin: Origin) => {
    setDeletingOrigin(origin);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeletingOrigin(null);
  }, []);

  return {
    showDeleteModal,
    deletingOrigin,
    openDeleteModal,
    closeDeleteModal
  };
};
