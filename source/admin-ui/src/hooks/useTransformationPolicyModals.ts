// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { TransformationPolicy } from '@data-models';

export const useTransformationPolicyModals = () => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<TransformationPolicy | null>(null);

  const openDeleteModal = (policy: TransformationPolicy) => {
    setDeletingPolicy(policy);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingPolicy(null);
  };

  return {
    showDeleteModal,
    deletingPolicy,
    openDeleteModal,
    closeDeleteModal
  };
};