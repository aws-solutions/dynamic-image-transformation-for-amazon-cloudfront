import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { OriginProvider, useOriginContext } from '../../contexts/OriginContext';
import { OriginService } from '../../services/originService';
import { MOCK_ORIGINS, MOCK_API_RESPONSES } from '../fixtures';

// Mock OriginService
vi.mock('../../services/originService', () => ({
  OriginService: {
    getOrigins: vi.fn(),
    createOrigin: vi.fn(),
    updateOrigin: vi.fn(),
    deleteOrigin: vi.fn()
  }
}));

const mockOriginService = OriginService as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OriginProvider>{children}</OriginProvider>
);

describe('OriginContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', async () => {
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.empty);

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      // Wait for initial loading to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.allOrigins).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedOrigins).toEqual([]);
    });

    it('should load origins on mount', async () => {
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      // Wait for the effect to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockOriginService.getOrigins).toHaveBeenCalledTimes(1);
      expect(result.current.allOrigins).toEqual(MOCK_ORIGINS);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle loading error', async () => {
      const errorMessage = 'Failed to load origins';
      mockOriginService.getOrigins.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.allOrigins).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Selection Management', () => {
    it('should set selected origins', async () => {
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSelectedOrigins([MOCK_ORIGINS[0]]);
      });

      expect(result.current.selectedOrigins).toEqual([MOCK_ORIGINS[0]]);
    });
  });

  describe('Create Origin', () => {
    it('should create origin successfully', async () => {
      const newOrigin = {
        id: '3',
        name: 'New Origin',
        domain: 'new.com',
        status: 'active' as const,
        customHeaders: []
      };

      mockOriginService.getOrigins.mockResolvedValueOnce({ 
        success: true, 
        data: { origins: MOCK_ORIGINS } 
      });
      mockOriginService.createOrigin.mockResolvedValueOnce({ 
        success: true, 
        data: newOrigin 
      });

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let createResult;
      await act(async () => {
        createResult = await result.current.createOrigin({
          name: 'New Origin',
          domain: 'new.com',
          status: 'active'
        });
      });

      expect(createResult).toEqual({ success: true, data: newOrigin });
      expect(result.current.allOrigins).toContainEqual(newOrigin);
      expect(mockOriginService.createOrigin).toHaveBeenCalledWith({
        name: 'New Origin',
        domain: 'new.com',
        status: 'active'
      });
    });

    it('should handle create origin error', async () => {
      const errorMessage = 'Failed to create origin';
      mockOriginService.getOrigins.mockResolvedValueOnce({ 
        success: true, 
        data: { origins: MOCK_ORIGINS } 
      });
      mockOriginService.createOrigin.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let createResult;
      await act(async () => {
        createResult = await result.current.createOrigin({
          name: 'New Origin',
          domain: 'new.com',
          status: 'active'
        });
      });

      expect(createResult).toEqual({ success: false, error: errorMessage });
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Update Origin', () => {
    it('should update origin successfully', async () => {
      const updatedOrigin = { ...MOCK_ORIGINS[0], originName: 'Updated Origin' };

      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);
      mockOriginService.updateOrigin.mockResolvedValueOnce({ success: true, data: updatedOrigin });

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateOrigin('1', { originName: 'Updated Origin' });
      });

      expect(updateResult).toEqual({ success: true, data: updatedOrigin });
      expect(result.current.allOrigins.find(o => o.originId === '1')?.originName).toBe('Updated Origin');
    });

    it('should handle update origin error', async () => {
      const errorMessage = 'Failed to update origin';
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);
      mockOriginService.updateOrigin.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateOrigin('1', { originName: 'Updated Origin' });
      });

      expect(updateResult).toEqual({ success: false, error: errorMessage });
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Delete Origin', () => {
    it('should delete origin successfully', async () => {
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);
      mockOriginService.deleteOrigin.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteOrigin('1');
      });

      expect(deleteResult).toEqual({ success: true });
      expect(result.current.allOrigins.find(o => o.originId === '1')).toBeUndefined();
      expect(mockOriginService.deleteOrigin).toHaveBeenCalledWith('1');
    });

    it('should handle delete origin error', async () => {
      const errorMessage = 'Failed to delete origin';
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);
      mockOriginService.deleteOrigin.mockResolvedValueOnce({ success: false, error: errorMessage });

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteOrigin('1');
      });

      expect(deleteResult).toEqual({ success: false, error: errorMessage });
      expect(result.current.error).toBe(errorMessage);
    });

    it('should remove deleted origin from selected origins', async () => {
      mockOriginService.getOrigins.mockResolvedValueOnce(MOCK_API_RESPONSES.origins.success);
      mockOriginService.deleteOrigin.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useOriginContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Select the origin first
      act(() => {
        result.current.setSelectedOrigins([MOCK_ORIGINS[0]]);
      });

      // Delete the selected origin
      await act(async () => {
        await result.current.deleteOrigin('1');
      });

      expect(result.current.selectedOrigins).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useOriginContext is used outside provider', () => {
      expect(() => {
        renderHook(() => useOriginContext());
      }).toThrow('useOriginContext must be used within an OriginProvider');
    });
  });
});
