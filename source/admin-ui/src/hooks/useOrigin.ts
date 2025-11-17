// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { Origin } from '@data-models';
import { OriginService } from '../services/originService';

export const useOrigin = (id: string | undefined) => {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrigin = async () => {
      if (!id) {
        setError('No origin ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await OriginService.getOrigin(id);
        if (!result.success || !result.data) throw new Error(result.error || 'Failed to load origin');
        setOrigin(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load origin details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrigin();
  }, [id]);

  const deleteOrigin = async () => {
    if (!origin) return { success: false, error: 'No origin to delete' };
    try {
      const result = await OriginService.deleteOrigin(origin.originId);
      if (!result.success) throw new Error(result.error || 'Failed to delete origin');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete origin' };
    }
  };

  return { origin, loading, error, deleteOrigin };
};
