// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOriginForm } from '../../hooks/useOriginForm';
import { OriginService } from '../../services/originService';

vi.mock('../../services/originService');

describe('useOriginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header conversion', () => {
    it('should convert initial headers object to array entries', () => {
      const initialData = {
        originName: 'test',
        originDomain: 'example.com',
        originPath: '/api',
        originHeaders: {
          'X-Custom-Header': 'value1',
          'Authorization': 'Bearer token'
        }
      };

      const { result } = renderHook(() => useOriginForm(initialData));

      expect(result.current.headerEntries).toHaveLength(2);
      expect(result.current.headerEntries[0]).toMatchObject({
        name: 'X-Custom-Header',
        value: 'value1'
      });
      expect(result.current.headerEntries[1]).toMatchObject({
        name: 'Authorization',
        value: 'Bearer token'
      });
    });

    it('should sync header entries back to formData', () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.addCustomHeader();
      });

      const headerId = result.current.headerEntries[0].id;

      act(() => {
        result.current.updateCustomHeader(headerId, 'name', 'X-Test');
      });

      act(() => {
        result.current.updateCustomHeader(headerId, 'value', 'test-value');
      });

      expect(result.current.formData.originHeaders).toEqual({
        'X-Test': 'test-value'
      });
    });

    it('should remove header from both entries and formData', () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.addCustomHeader();
      });

      const headerId = result.current.headerEntries[0].id;

      act(() => {
        result.current.updateCustomHeader(headerId, 'name', 'X-Remove');
        result.current.updateCustomHeader(headerId, 'value', 'value');
      });

      act(() => {
        result.current.removeCustomHeader(headerId);
      });

      expect(result.current.headerEntries).toHaveLength(0);
      expect(result.current.formData.originHeaders).toEqual({});
    });
  });

  describe('Validation', () => {
    it('should validate valid form data', async () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.updateField('originName', 'ValidName');
        result.current.updateField('originDomain', 'example.com');
      });

      (OriginService.createOrigin as vi.Mock).mockResolvedValue({ success: true });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitForm(false);
      });

      expect(result.current.errors).toEqual({});
      expect(submitResult).toEqual({ success: true });
      expect(OriginService.createOrigin).toHaveBeenCalledTimes(1);
    });

    it('should set validation errors for invalid data', async () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.updateField('originName', '');
        result.current.updateField('originDomain', 'invalid domain');
      });

      await act(async () => {
        await result.current.submitForm(false);
      });

      expect(result.current.errors).toBeDefined();
      expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
      expect(OriginService.createOrigin).not.toHaveBeenCalledTimes(1);
    });

    it('should clear field error when field is updated', async () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.updateField('originName', '');
        result.current.updateField('originDomain', 'example.com');
      });

      await act(async () => {
        await result.current.submitForm(false);
      });

      expect(result.current.errors.originName).toBeDefined();

      act(() => {
        result.current.updateField('originName', 'ValidName');
      });

      expect(result.current.errors.originName).toBeUndefined();
    });
  });

  describe('Form submission', () => {
    it('should call createOrigin for new origins', async () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.updateField('originName', 'NewOrigin');
        result.current.updateField('originDomain', 'example.com');
      });

      (OriginService.createOrigin as vi.Mock).mockResolvedValue({ success: true });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitForm(false);
      });

      expect(submitResult).toEqual({ success: true });
      expect(OriginService.createOrigin).toHaveBeenCalledWith(
        expect.objectContaining({
          originName: 'NewOrigin',
          originDomain: 'example.com',
          originHeaders: {}
        })
      );
    });

    it('should call updateOrigin for existing origins', async () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.updateField('originName', 'UpdatedOrigin');
        result.current.updateField('originDomain', 'example.com');
      });

      (OriginService.updateOrigin as vi.Mock).mockResolvedValue({ success: true });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitForm(true, 'origin-123');
      });

      expect(submitResult).toEqual({ success: true });
      expect(OriginService.updateOrigin).toHaveBeenCalledWith('origin-123',
        expect.objectContaining({
          originName: 'UpdatedOrigin',
          originDomain: 'example.com',
          originHeaders: {}
        })
      );
    });

    it('should return error when validation fails', async () => {
      const { result } = renderHook(() => useOriginForm());

      act(() => {
        result.current.updateField('originName', '');
        result.current.updateField('originDomain', 'invalid');
      });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submitForm(false);
      });

      expect(submitResult).toEqual({ success: false, error: 'Please fix validation errors' });
      expect(OriginService.createOrigin).not.toHaveBeenCalledTimes(1);
    });
  });
});
