// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from 'react';
import { TransformationPolicy } from '@data-models';

export const useTransformationPolicyFilters = (policies: TransformationPolicy[]) => {
  const [filteringText, setFilteringText] = useState('');

  const filteredPolicies = useMemo(() => {
    if (!filteringText) return policies;
    
    const searchTerm = filteringText.toLowerCase();
    return policies.filter(policy => 
      policy.policyName.toLowerCase().includes(searchTerm) ||
      (policy.description && policy.description.toLowerCase().includes(searchTerm))
    );
  }, [policies, filteringText]);

  return {
    filteringText,
    setFilteringText,
    filteredPolicies
  };
};