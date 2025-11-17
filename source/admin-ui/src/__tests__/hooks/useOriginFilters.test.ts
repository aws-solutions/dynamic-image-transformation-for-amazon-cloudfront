// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOriginFilters } from '../../hooks/useOriginFilters';

const TEST_ORIGINs = [
  {
    originId: '1',
    originName: 'Primary Server',
    originDomain: 'example.com',
    originPath: '/api',
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    originId: '2',
    originName: 'Secondary Server',
    originDomain: 'test.com',
    originPath: '/v1',
    createdAt: '2024-01-10T09:00:00Z'
  }
];

describe('useOriginFilters', () => {
  it('should return all origins when no filter is applied', () => {
    const { result } = renderHook(() => useOriginFilters(TEST_ORIGINs));

    expect(result.current.filteredOrigins).toEqual(TEST_ORIGINs);
    expect(result.current.filteringText).toBe('');
  });

  it('should filter origins by name', () => {
    const { result } = renderHook(() => useOriginFilters(TEST_ORIGINs));

    act(() => {
      result.current.setFilteringText('Primary');
    });

    expect(result.current.filteredOrigins).toHaveLength(1);
    expect(result.current.filteredOrigins[0].originName).toBe('Primary Server');
  });

  it('should filter origins by domain', () => {
    const { result } = renderHook(() => useOriginFilters(TEST_ORIGINs));

    act(() => {
      result.current.setFilteringText('test.com');
    });

    expect(result.current.filteredOrigins).toHaveLength(1);
    expect(result.current.filteredOrigins[0].originDomain).toBe('test.com');
  });

  it('should filter origins by path', () => {
    const { result } = renderHook(() => useOriginFilters(TEST_ORIGINs));

    act(() => {
      result.current.setFilteringText('/v1');
    });

    expect(result.current.filteredOrigins).toHaveLength(1);
    expect(result.current.filteredOrigins[0].originPath).toBe('/v1');
  });

  it('should return empty array when no matches found', () => {
    const { result } = renderHook(() => useOriginFilters(TEST_ORIGINs));

    act(() => {
      result.current.setFilteringText('nonexistent');
    });

    expect(result.current.filteredOrigins).toHaveLength(0);
  });
});
