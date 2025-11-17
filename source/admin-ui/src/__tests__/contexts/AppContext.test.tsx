import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from '../../contexts/AppContext';
import { TEST_NOTIFICATION } from '../fixtures';

// Mock timers for notification auto-removal
vi.useFakeTimers();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.notifications).toEqual([]);
      expect(result.current.theme).toBe('light');
      expect(result.current.globalLoading).toBe(false);
    });
  });

  describe('User Management', () => {
    it('should set user', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin'
      };

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
    });

    it('should clear user', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin'
      };

      act(() => {
        result.current.setUser(mockUser);
      });

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('Notification Management', () => {
    it('should add notification', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.addNotification(TEST_NOTIFICATION);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject(TEST_NOTIFICATION);
      expect(result.current.notifications[0].id).toBeDefined();
      expect(result.current.notifications[0].timestamp).toBeInstanceOf(Date);
    });

    it('should remove notification', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.addNotification({
          type: 'success',
          message: 'Test notification'
        });
      });

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.removeNotification(notificationId);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.addNotification({
          type: 'success',
          message: 'Test notification 1'
        });
        result.current.addNotification({
          type: 'error',
          message: 'Test notification 2'
        });
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('should auto-remove notification after 5 seconds', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.addNotification({
          type: 'success',
          message: 'Test notification'
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('Theme Management', () => {
    it('should set theme to dark', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should set theme to light', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('Global Loading', () => {
    it('should set global loading to true', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.setGlobalLoading(true);
      });

      expect(result.current.globalLoading).toBe(true);
    });

    it('should set global loading to false', () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      act(() => {
        result.current.setGlobalLoading(true);
      });

      act(() => {
        result.current.setGlobalLoading(false);
      });

      expect(result.current.globalLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useApp is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useApp());
      }).toThrow('useApp must be used within an AppProvider');
      
      consoleSpy.mockRestore();
    });
  });
});
