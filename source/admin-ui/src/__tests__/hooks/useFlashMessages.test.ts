// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlashMessages } from '../../hooks/useFlashMessages';

vi.useFakeTimers();

describe('useFlashMessages', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useFlashMessages());
    expect(result.current.messages).toEqual([]);
  });

  it('should add a message', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({
        type: 'success',
        content: 'Test message',
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      type: 'success',
      content: 'Test message',
      dismissible: true,
    });
    expect(result.current.messages[0].id).toBeDefined();
  });

  it('should auto-dismiss message after 5 seconds', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({
        type: 'success',
        content: 'Test message',
      });
    });

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should manually dismiss message', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({
        type: 'success',
        content: 'Test message',
      });
    });

    const messageId = result.current.messages[0].id!;

    act(() => {
      result.current.dismissMessage(messageId);
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should clear timeout when manually dismissed', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({
        type: 'success',
        content: 'Test message',
      });
    });

    const messageId = result.current.messages[0].id!;

    act(() => {
      result.current.dismissMessage(messageId);
    });

    expect(result.current.messages).toHaveLength(0);

    // Advance time - should not cause any issues since timeout was cleared
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should clear all messages', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({ type: 'success', content: 'Message 1' });
      result.current.addMessage({ type: 'error', content: 'Message 2' });
      result.current.addMessage({ type: 'info', content: 'Message 3' });
    });

    expect(result.current.messages).toHaveLength(3);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should clear all timeouts when clearing messages', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({ type: 'success', content: 'Message 1' });
      result.current.addMessage({ type: 'error', content: 'Message 2' });
    });

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);

    // Advance time - should not cause any issues since timeouts were cleared
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should handle multiple messages with staggered timeouts', () => {
    const { result } = renderHook(() => useFlashMessages());

    act(() => {
      result.current.addMessage({ type: 'success', content: 'Message 1' });
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.addMessage({ type: 'error', content: 'Message 2' });
    });

    expect(result.current.messages).toHaveLength(2);

    // First message should dismiss after 3 more seconds (5 total)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Message 2');

    // Second message should dismiss after 2 more seconds (5 total from its creation)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.messages).toHaveLength(0);
  });
});
