import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TransformationPolicyProvider, useTransformationPolicyContext } from '../../contexts/TransformationPolicyContext';
import { TransformationPolicyService } from '../../services/transformationPolicyService';
import { MOCK_POLICIES, MOCK_API_RESPONSES } from '../fixtures';

vi.mock('../../services/transformationPolicyService', () => ({
  TransformationPolicyService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

const mockPolicyService = TransformationPolicyService as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TransformationPolicyProvider>{children}</TransformationPolicyProvider>
);

describe('TransformationPolicyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', async () => {
      mockPolicyService.list.mockResolvedValueOnce({ 
        success: true, 
        data: { items: [] } 
      });

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.allPolicies).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedPolicies).toEqual([]);
    });

    it('should load policies on mount', async () => {
      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockPolicyService.list).toHaveBeenCalledTimes(1);
      expect(result.current.allPolicies).toEqual(MOCK_POLICIES);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle loading error', async () => {
      const errorMessage = 'Failed to load policies';
      mockPolicyService.list.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.allPolicies).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Create Policy', () => {
    it('should create policy successfully', async () => {
      const newPolicy = { policyId: '3', policyName: 'New Policy', transformations: [] };

      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.create.mockResolvedValueOnce({ success: true, data: newPolicy });

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let createResult;
      await act(async () => {
        createResult = await result.current.createPolicy({ policyName: 'New Policy', transformations: [] });
      });

      expect(createResult).toEqual({ success: true, data: newPolicy });
      expect(result.current.allPolicies).toHaveLength(3);
    });

    it('should handle create policy error', async () => {
      const errorMessage = 'Failed to create policy';
      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.create.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let createResult;
      await act(async () => {
        createResult = await result.current.createPolicy({ policyName: 'New Policy', transformations: [] });
      });

      expect(createResult).toEqual({ success: false, error: errorMessage });
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Update Policy', () => {
    it('should update policy successfully', async () => {
      const updatedPolicy = { ...MOCK_POLICIES[0], policyName: 'Updated Policy' };

      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.update.mockResolvedValueOnce({ success: true, data: updatedPolicy });

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updatePolicy('1', { policyName: 'Updated Policy' });
      });

      expect(updateResult).toEqual({ success: true, data: updatedPolicy });
      expect(result.current.allPolicies.find(p => p.policyId === '1')?.policyName).toBe('Updated Policy');
    });

    it('should handle update policy error', async () => {
      const errorMessage = 'Failed to update policy';
      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.update.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updatePolicy('1', { policyName: 'Updated Policy' });
      });

      expect(updateResult).toEqual({ success: false, error: errorMessage });
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Delete Policy', () => {
    it('should delete policy successfully', async () => {
      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.delete.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deletePolicy('1');
      });

      expect(deleteResult).toEqual({ success: true });
      expect(result.current.allPolicies.find(p => p.policyId === '1')).toBeUndefined();
      expect(mockPolicyService.delete).toHaveBeenCalledWith('1');
    });

    it('should handle delete policy error', async () => {
      const errorMessage = 'Failed to delete policy';
      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.delete.mockResolvedValueOnce({ success: false, error: errorMessage });

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deletePolicy('1');
      });

      expect(deleteResult).toEqual({ success: false, error: errorMessage });
      expect(result.current.error).toBe(errorMessage);
    });

    it('should remove deleted policy from selected policies', async () => {
      mockPolicyService.list.mockResolvedValueOnce(MOCK_API_RESPONSES.policies.success);
      mockPolicyService.delete.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTransformationPolicyContext(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSelectedPolicies([MOCK_POLICIES[0]]);
      });

      await act(async () => {
        await result.current.deletePolicy('1');
      });

      expect(result.current.selectedPolicies).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useTransformationPolicyContext is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useTransformationPolicyContext());
      }).toThrow('useTransformationPolicyContext must be used within a TransformationPolicyProvider');
      
      consoleSpy.mockRestore();
    });
  });
});
