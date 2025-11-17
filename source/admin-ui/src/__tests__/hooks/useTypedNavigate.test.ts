// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useTypedNavigate } from '../../hooks/useTypedNavigate';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useTypedNavigate', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('provides navigation functions', () => {
    const { result } = renderHook(() => useTypedNavigate(), {
      wrapper: BrowserRouter,
    });

    expect(result.current.toOrigins).toBeDefined();
    expect(result.current.toOriginCreate).toBeDefined();
    expect(result.current.toOriginDetails).toBeDefined();
    expect(result.current.toOriginEdit).toBeDefined();
  });

  it('should navigate to origins page', () => {
    const { result } = renderHook(() => useTypedNavigate(), {
      wrapper: BrowserRouter,
    });

    result.current.toOrigins();
    expect(mockNavigate).toHaveBeenCalledWith('/origins');
  });

  it('should navigate to origin details with id', () => {
    const { result } = renderHook(() => useTypedNavigate(), {
      wrapper: BrowserRouter,
    });

    result.current.toOriginDetails('123');
    expect(mockNavigate).toHaveBeenCalledWith('/origins/123');
  });

  it('should navigate to origin edit with id', () => {
    const { result } = renderHook(() => useTypedNavigate(), {
      wrapper: BrowserRouter,
    });

    result.current.toOriginEdit('123');
    expect(mockNavigate).toHaveBeenCalledWith('/origins/123/edit');
  });
});
