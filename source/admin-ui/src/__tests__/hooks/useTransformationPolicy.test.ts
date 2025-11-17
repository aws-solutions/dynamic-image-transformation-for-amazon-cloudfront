// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTransformationPolicy } from '../../hooks/useTransformationPolicy';
import { TransformationPolicyService } from '../../services/transformationPolicyService';

vi.mock('../../services/transformationPolicyService');

const mockTransformationPolicyService = vi.mocked(TransformationPolicyService);

describe('useTransformationPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useTransformationPolicy('test-id'));

    expect(result.current.loading).toBe(true);
    expect(result.current.policy).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch policy successfully', async () => {
    const TEST_POLICY = {
      policyId: 'test-id',
      policyName: 'Test Policy',
      description: 'Test Description',
      isDefault: false,
      policyJSON: { transformations: [] },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    mockTransformationPolicyService.get.mockResolvedValueOnce({
      success: true,
      data: TEST_POLICY
    });

    const { result } = renderHook(() => useTransformationPolicy('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.policy).toEqual(TEST_POLICY);
    expect(result.current.error).toBe(null);
    expect(mockTransformationPolicyService.get).toHaveBeenCalledWith('test-id');
  });

  it('should handle service error', async () => {
    mockTransformationPolicyService.get.mockResolvedValueOnce({
      success: false,
      error: 'Policy not found'
    });

    const { result } = renderHook(() => useTransformationPolicy('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.policy).toBe(null);
    expect(result.current.error).toBe('Policy not found');
  });

  it('should handle network error', async () => {
    mockTransformationPolicyService.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTransformationPolicy('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.policy).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle missing policy ID', async () => {
    const { result } = renderHook(() => useTransformationPolicy(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.policy).toBe(null);
    expect(result.current.error).toBe('No policy ID provided');
    expect(mockTransformationPolicyService.get).not.toHaveBeenCalledTimes(1);
  });

  it('should refetch when ID changes', async () => {
    const TEST_POLICY1 = { policyId: 'id1', policyName: 'Policy 1' };
    const TEST_POLICY2 = { policyId: 'id2', policyName: 'Policy 2' };

    mockTransformationPolicyService.get
      .mockResolvedValueOnce({ success: true, data: TEST_POLICY1 })
      .mockResolvedValueOnce({ success: true, data: TEST_POLICY2 });

    const { result, rerender } = renderHook(
      ({ id }) => useTransformationPolicy(id),
      { initialProps: { id: 'id1' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.policy).toEqual(TEST_POLICY1);

    rerender({ id: 'id2' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.policy).toEqual(TEST_POLICY2);
    expect(mockTransformationPolicyService.get).toHaveBeenCalledTimes(2);
  });
});
