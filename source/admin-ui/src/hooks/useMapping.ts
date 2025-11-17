// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { Mapping } from '@data-models';
import { MappingService } from '../services/mappingService';

export const useMapping = (id: string | undefined) => {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMapping = async () => {
      if (!id) {
        setError('No mapping ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await MappingService.getMapping(id);
        if (!result.success || !result.data) throw new Error(result.error || 'Failed to load mapping');
        setMapping(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load mapping details');
      } finally {
        setLoading(false);
      }
    };

    fetchMapping();
  }, [id]);

  return { mapping, loading, error };
};