// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMappingFilters } from '../../hooks/useMappingFilters';
import { Mapping } from '../../types/originMapping';

const TEST_MAPPINGs: Mapping[] = [
  {
    mappingId: '1',
    name: 'Test Mapping',
    description: 'Test Description',
    hostHeaderPattern: 'example.com',
    pathPattern: '/test/*',
    originId: 'origin-1',
    policyId: 'policy-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    mappingId: '2',
    name: 'Another Mapping',
    description: 'Another Description',
    hostHeaderPattern: 'example2.com',
    pathPattern: '/api/*',
    originId: 'origin-2',
    policyId: 'policy-2',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

describe('useMappingFilters', () => {
  it('should initialize with empty filter and return all mappings', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    expect(result.current.filteringText).toBe('');
    expect(result.current.filteredMappings).toEqual(TEST_MAPPINGs);
  });

  it('should filter mappings by name', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    act(() => {
      result.current.setFilteringText('Test');
    });

    expect(result.current.filteringText).toBe('Test');
    expect(result.current.filteredMappings).toHaveLength(1);
    expect(result.current.filteredMappings[0].name).toBe('Test Mapping');
  });

  it('should filter mappings by description', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    act(() => {
      result.current.setFilteringText('Another');
    });

    expect(result.current.filteredMappings).toHaveLength(1);
    expect(result.current.filteredMappings[0].description).toBe('Another Description');
  });

  it('should filter mappings by host pattern', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    act(() => {
      result.current.setFilteringText('example.com');
    });

    expect(result.current.filteredMappings).toHaveLength(1);
    expect(result.current.filteredMappings[0].hostHeaderPattern).toBe('example.com');
  });

  it('should filter mappings by path pattern', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    act(() => {
      result.current.setFilteringText('/api/');
    });

    expect(result.current.filteredMappings).toHaveLength(1);
    expect(result.current.filteredMappings[0].pathPattern).toBe('/api/*');
  });

  it('should return empty array when no matches found', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    act(() => {
      result.current.setFilteringText('nonexistent');
    });

    expect(result.current.filteredMappings).toHaveLength(0);
  });

  it('should be case insensitive', () => {
    const { result } = renderHook(() => useMappingFilters(TEST_MAPPINGs));

    act(() => {
      result.current.setFilteringText('TEST');
    });

    expect(result.current.filteredMappings).toHaveLength(1);
    expect(result.current.filteredMappings[0].name).toBe('Test Mapping');
  });
});
