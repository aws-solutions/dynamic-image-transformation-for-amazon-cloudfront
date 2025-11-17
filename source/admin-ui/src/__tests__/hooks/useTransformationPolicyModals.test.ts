// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransformationPolicyModals } from '../../hooks/useTransformationPolicyModals';

const TEST_POLICY = {
  policyId: '1',
  policyName: 'Test Policy',
  description: 'Test Description',
  isDefault: false,
  policyJSON: { transformations: [] },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('useTransformationPolicyModals', () => {
  it('should initialize with closed modal state', () => {
    const { result } = renderHook(() => useTransformationPolicyModals());

    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.deletingPolicy).toBeNull();
  });

  it('should open delete modal with policy', () => {
    const { result } = renderHook(() => useTransformationPolicyModals());

    act(() => {
      result.current.openDeleteModal(TEST_POLICY);
    });

    expect(result.current.showDeleteModal).toBe(true);
    expect(result.current.deletingPolicy).toEqual(TEST_POLICY);
  });

  it('should close delete modal and clears policy', () => {
    const { result } = renderHook(() => useTransformationPolicyModals());

    // First open the modal
    act(() => {
      result.current.openDeleteModal(TEST_POLICY);
    });

    expect(result.current.showDeleteModal).toBe(true);
    expect(result.current.deletingPolicy).toEqual(TEST_POLICY);

    // Then close it
    act(() => {
      result.current.closeDeleteModal();
    });

    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.deletingPolicy).toBeNull();
  });
});
