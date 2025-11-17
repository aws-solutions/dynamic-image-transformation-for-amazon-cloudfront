// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { TransformationPolicy } from '@data-models';
import { TransformationPolicyService } from '../services/transformationPolicyService';

export const useTransformationPolicy = (id: string | undefined) => {
  const [policy, setPolicy] = useState<TransformationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      if (!id) {
        setError('No policy ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await TransformationPolicyService.get(id);
        if (!result.success || !result.data) throw new Error(result.error || 'Failed to load policy');
        setPolicy(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load policy details');
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, [id]);

  return { policy, loading, error };
};