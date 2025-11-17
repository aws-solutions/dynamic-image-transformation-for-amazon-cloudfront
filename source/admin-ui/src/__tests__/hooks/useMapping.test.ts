// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMapping } from '../../hooks/useMapping';
import { MappingService } from '../../services/mappingService';

vi.mock('../../services/mappingService');

const TEST_MAPPINGService = vi.mocked(MappingService);

describe('useMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useMapping('test-id'));

    expect(result.current.loading).toBe(true);
    expect(result.current.mapping).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch mapping successfully', async () => {
    const TEST_MAPPING = {
      mappingId: 'test-id',
      mappingName: 'Test Mapping',
      originId: 'origin-1',
      hostHeaderPattern: '*.example.com'
    };

    TEST_MAPPINGService.getMapping.mockResolvedValueOnce({
      success: true,
      data: TEST_MAPPING
    });

    const { result } = renderHook(() => useMapping('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mapping).toEqual(TEST_MAPPING);
    expect(result.current.error).toBe(null);
    expect(TEST_MAPPINGService.getMapping).toHaveBeenCalledWith('test-id');
  });

  it('should handle service error', async () => {
    TEST_MAPPINGService.getMapping.mockResolvedValueOnce({
      success: false,
      error: 'Mapping not found'
    });

    const { result } = renderHook(() => useMapping('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mapping).toBe(null);
    expect(result.current.error).toBe('Mapping not found');
  });

  it('should handle network error', async () => {
    TEST_MAPPINGService.getMapping.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMapping('test-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mapping).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle missing mapping ID', async () => {
    const { result } = renderHook(() => useMapping(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mapping).toBe(null);
    expect(result.current.error).toBe('No mapping ID provided');
    expect(TEST_MAPPINGService.getMapping).not.toHaveBeenCalledTimes(1);
  });

  it('should refetch when ID changes', async () => {
    const TEST_MAPPING1 = { mappingId: 'id1', mappingName: 'Mapping 1' };
    const TEST_MAPPING2 = { mappingId: 'id2', mappingName: 'Mapping 2' };

    TEST_MAPPINGService.getMapping
      .mockResolvedValueOnce({ success: true, data: TEST_MAPPING1 })
      .mockResolvedValueOnce({ success: true, data: TEST_MAPPING2 });

    const { result, rerender } = renderHook(
      ({ id }) => useMapping(id),
      { initialProps: { id: 'id1' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mapping).toEqual(TEST_MAPPING1);

    rerender({ id: 'id2' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mapping).toEqual(TEST_MAPPING2);
    expect(TEST_MAPPINGService.getMapping).toHaveBeenCalledTimes(2);
  });
});
