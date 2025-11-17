// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMappingModals } from '../../hooks/useMappingModals';
import { Mapping } from '../../types/originMapping';

const TEST_MAPPING: Mapping = {
  mappingId: '1',
  name: 'Test Mapping',
  description: 'Test Description',
  hostHeaderPattern: 'example.com',
  pathPattern: '/test/*',
  originId: 'origin-1',
  policyId: 'policy-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('useMappingModals', () => {
  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useMappingModals());

    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.deletingMapping).toBe(null);
    expect(typeof result.current.openDeleteModal).toBe('function');
    expect(typeof result.current.closeDeleteModal).toBe('function');
  });

  it('should open delete modal with mapping', () => {
    const { result } = renderHook(() => useMappingModals());

    act(() => {
      result.current.openDeleteModal(TEST_MAPPING);
    });

    expect(result.current.showDeleteModal).toBe(true);
    expect(result.current.deletingMapping).toBe(TEST_MAPPING);
  });

  it('should close delete modal', () => {
    const { result } = renderHook(() => useMappingModals());

    // First open the modal
    act(() => {
      result.current.openDeleteModal(TEST_MAPPING);
    });

    expect(result.current.showDeleteModal).toBe(true);

    // Then close it
    act(() => {
      result.current.closeDeleteModal();
    });

    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.deletingMapping).toBe(null);
  });
});
