// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransformationPolicyFilters } from '../../hooks/useTransformationPolicyFilters';

const mockPolicies = [
  {
    policyId: '1',
    policyName: 'Mobile Optimization',
    description: 'Optimized for mobile devices',
    isDefault: true,
    policyJSON: { transformations: [] },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    policyId: '2',
    policyName: 'Desktop Quality',
    description: 'High quality for desktop viewing',
    isDefault: false,
    policyJSON: { transformations: [] },
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  },
  {
    policyId: '3',
    policyName: 'Social Media',
    description: null,
    isDefault: false,
    policyJSON: { transformations: [] },
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  }
];

describe('useTransformationPolicyFilters', () => {
  it('should initialize with empty filter and all policies', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    expect(result.current.filteringText).toBe('');
    expect(result.current.filteredPolicies).toEqual(mockPolicies);
  });

  it('should filter policies by name', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    act(() => {
      result.current.setFilteringText('Mobile');
    });

    expect(result.current.filteringText).toBe('Mobile');
    expect(result.current.filteredPolicies).toHaveLength(1);
    expect(result.current.filteredPolicies[0].policyName).toBe('Mobile Optimization');
  });

  it('should filter policies by description', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    act(() => {
      result.current.setFilteringText('desktop');
    });

    expect(result.current.filteredPolicies).toHaveLength(1);
    expect(result.current.filteredPolicies[0].policyName).toBe('Desktop Quality');
  });

  it('should handle case insensitive search', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    act(() => {
      result.current.setFilteringText('MOBILE');
    });

    expect(result.current.filteredPolicies).toHaveLength(1);
    expect(result.current.filteredPolicies[0].policyName).toBe('Mobile Optimization');
  });

  it('should return empty array when no matches found', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    act(() => {
      result.current.setFilteringText('nonexistent');
    });

    expect(result.current.filteredPolicies).toHaveLength(0);
  });

  it('should handle policies with null description', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    act(() => {
      result.current.setFilteringText('Social');
    });

    expect(result.current.filteredPolicies).toHaveLength(1);
    expect(result.current.filteredPolicies[0].policyName).toBe('Social Media');
  });

  it('should return all policies when filter is cleared', () => {
    const { result } = renderHook(() => useTransformationPolicyFilters(mockPolicies));

    // Set filter
    act(() => {
      result.current.setFilteringText('Mobile');
    });

    expect(result.current.filteredPolicies).toHaveLength(1);

    // Clear filter
    act(() => {
      result.current.setFilteringText('');
    });

    expect(result.current.filteredPolicies).toEqual(mockPolicies);
  });
});
