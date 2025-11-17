// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOriginModals } from '../../hooks/useOriginModals';
import { TEST_ORIGIN } from '../fixtures';

describe('useOriginModals', () => {
  it('should initialize with closed modal state', () => {
    const { result } = renderHook(() => useOriginModals());

    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.deletingOrigin).toBeNull();
  });

  it('should open delete modal with origin', () => {
    const { result } = renderHook(() => useOriginModals());

    act(() => {
      result.current.openDeleteModal(TEST_ORIGIN);
    });

    expect(result.current.showDeleteModal).toBe(true);
    expect(result.current.deletingOrigin).toEqual(TEST_ORIGIN);
  });

  it('should close delete modal and clears origin', () => {
    const { result } = renderHook(() => useOriginModals());

    act(() => {
      result.current.openDeleteModal(TEST_ORIGIN);
    });

    act(() => {
      result.current.closeDeleteModal();
    });

    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.deletingOrigin).toBeNull();
  });
});
