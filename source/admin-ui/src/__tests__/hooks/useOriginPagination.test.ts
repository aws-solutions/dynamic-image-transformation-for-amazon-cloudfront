// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOriginPagination } from '../../hooks/useOriginPagination';
import { MOCK_ORIGINS } from '../fixtures';

const mockOrigins = Array.from({ length: 25 }, (_, i) => ({
  ...MOCK_ORIGINS[0],
  originId: `${i + 1}`,
  originName: `Origin ${i + 1}`,
  originDomain: `example${i + 1}.com`
}));

describe('useOriginPagination', () => {
  it('should initialize with first page', () => {
    const { result } = renderHook(() => useOriginPagination(mockOrigins, 10));

    expect(result.current.currentPageIndex).toBe(1);
    expect(result.current.paginatedOrigins).toHaveLength(10);
    expect(result.current.totalPages).toBe(3);
  });

  it('should return correct items for first page', () => {
    const { result } = renderHook(() => useOriginPagination(mockOrigins, 10));

    expect(result.current.paginatedOrigins[0].originName).toBe('Origin 1');
    expect(result.current.paginatedOrigins[9].originName).toBe('Origin 10');
  });

  it('should navigate to different page', () => {
    const { result } = renderHook(() => useOriginPagination(mockOrigins, 10));

    act(() => {
      result.current.setCurrentPageIndex(2);
    });

    expect(result.current.currentPageIndex).toBe(2);
    expect(result.current.paginatedOrigins[0].originName).toBe('Origin 11');
    expect(result.current.paginatedOrigins[9].originName).toBe('Origin 20');
  });

  it('should handle last page with fewer items', () => {
    const { result } = renderHook(() => useOriginPagination(mockOrigins, 10));

    act(() => {
      result.current.setCurrentPageIndex(3);
    });

    expect(result.current.paginatedOrigins).toHaveLength(5);
    expect(result.current.paginatedOrigins[0].originName).toBe('Origin 21');
    expect(result.current.paginatedOrigins[4].originName).toBe('Origin 25');
  });

  it('should reset to page 1 when origins change', () => {
    const { result, rerender } = renderHook(
      ({ origins }) => useOriginPagination(origins, 10),
      { initialProps: { origins: mockOrigins } }
    );

    act(() => {
      result.current.setCurrentPageIndex(2);
    });

    expect(result.current.currentPageIndex).toBe(2);

    rerender({ origins: mockOrigins.slice(0, 5) });

    expect(result.current.currentPageIndex).toBe(1);
  });
});
