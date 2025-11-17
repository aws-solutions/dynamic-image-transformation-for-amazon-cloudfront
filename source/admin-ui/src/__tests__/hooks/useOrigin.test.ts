// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOrigin } from '../../hooks/useOrigin';
import { OriginService } from '../../services/originService';

vi.mock('../../services/originService');

const TEST_ORIGINService = vi.mocked(OriginService);

describe('useOrigin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useOrigin('test-id'));

    expect(result.current.loading).toBe(true);
    expect(result.current.origin).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.deleteOrigin).toBe('function');
  });

  it('should fetch origin successfully', async () => {
    const TEST_ORIGIN = {
      originId: 'test-id',
      originName: 'Test Origin',
      originDomain: 'example.com',
      originPath: '/api'
    };

    TEST_ORIGINService.getOrigin.mockResolvedValueOnce({
      success: true,
      data: TEST_ORIGIN
    });

    const { result } = renderHook(() => useOrigin('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.origin).toEqual(TEST_ORIGIN);
    expect(result.current.error).toBe(null);
    expect(TEST_ORIGINService.getOrigin).toHaveBeenCalledWith('test-id');
  });

  it('should handle service error', async () => {
    TEST_ORIGINService.getOrigin.mockResolvedValueOnce({
      success: false,
      error: 'Origin not found'
    });

    const { result } = renderHook(() => useOrigin('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.origin).toBe(null);
    expect(result.current.error).toBe('Origin not found');
  });

  it('should handle network error', async () => {
    TEST_ORIGINService.getOrigin.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useOrigin('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.origin).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle missing origin ID', async () => {
    const { result } = renderHook(() => useOrigin(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.origin).toBe(null);
    expect(result.current.error).toBe('No origin ID provided');
    expect(TEST_ORIGINService.getOrigin).not.toHaveBeenCalledTimes(1);
  });

  it('should delete origin successfully', async () => {
    const TEST_ORIGIN = {
      originId: 'test-id',
      originName: 'Test Origin',
      originDomain: 'example.com'
    };

    TEST_ORIGINService.getOrigin.mockResolvedValueOnce({
      success: true,
      data: TEST_ORIGIN
    });

    TEST_ORIGINService.deleteOrigin.mockResolvedValueOnce({
      success: true
    });

    const { result } = renderHook(() => useOrigin('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteOrigin();
    });

    expect(deleteResult).toEqual({ success: true });
    expect(TEST_ORIGINService.deleteOrigin).toHaveBeenCalledWith('test-id');
  });

  it('should handle delete error', async () => {
    const TEST_ORIGIN = {
      originId: 'test-id',
      originName: 'Test Origin',
      originDomain: 'example.com'
    };

    TEST_ORIGINService.getOrigin.mockResolvedValueOnce({
      success: true,
      data: TEST_ORIGIN
    });

    TEST_ORIGINService.deleteOrigin.mockResolvedValueOnce({
      success: false,
      error: 'Delete failed'
    });

    const { result } = renderHook(() => useOrigin('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteOrigin();
    });

    expect(deleteResult).toEqual({ success: false, error: 'Delete failed' });
  });

  it('should handle delete when no origin loaded', async () => {
    const { result } = renderHook(() => useOrigin(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteOrigin();
    });

    expect(deleteResult).toEqual({ success: false, error: 'No origin to delete' });
    expect(TEST_ORIGINService.deleteOrigin).not.toHaveBeenCalledTimes(1);
  });
});
