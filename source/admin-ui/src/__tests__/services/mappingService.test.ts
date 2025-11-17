// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { MappingService } from '../../services/mappingService';
import { TEST_MAPPING, MOCK_MAPPINGS } from '../fixtures';

const mockFetch = vi.fn();

describe('MappingService', () => {
  beforeAll(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  describe('getMappings', () => {
    it('should fetch mappings successfully', async () => {
      const mockBackendResponse = {
        items: [
          { mappingId: '1', name: 'Test Mapping 1', originId: '1' },
          { mappingId: '2', name: 'Test Mapping 2', originId: '2' }
        ],
        nextToken: 'token123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockBackendResponse))
      });

      const result = await MappingService.getMappings();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        mappings: mockBackendResponse.items,
        nextToken: mockBackendResponse.nextToken
      });
    });

    it('should handle HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => ''
      } as Response);

      const result = await MappingService.getMappings();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await MappingService.getMappings();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getMapping', () => {
    it('should fetch single mapping successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(TEST_MAPPING))
      });

      const result = await MappingService.getMapping('1');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(TEST_MAPPING);
    });

    it('should handle not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => ''
      } as Response);

      const result = await MappingService.getMapping('999');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });
  });

  describe('createMapping', () => {
    it('should create mapping successfully', async () => {
      const mappingData = {
        name: 'New Mapping',
        description: 'Test mapping',
        originId: '1',
        hostHeaderPattern: '*.example.com'
      };

      const mockResponse = { mappingId: '3', ...mappingData };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await MappingService.createMapping(mappingData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle validation error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => ''
      } as Response);

      const result = await MappingService.createMapping({ name: '', originId: '1' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 400: Bad Request');
    });
  });

  describe('updateMapping', () => {
    it('should update mapping successfully', async () => {
      const mappingData = {
        name: 'Updated Mapping',
        description: 'Updated description',
        originId: '1'
      };

      const mockResponse = { mappingId: '1', ...mappingData };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await MappingService.updateMapping('1', mappingData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('deleteMapping', () => {
    it('should delete mapping successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('')
      });

      const result = await MappingService.deleteMapping('1');
      
      expect(result.success).toBe(true);
    });

    it('should handle delete error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => ''
      } as Response);

      const result = await MappingService.deleteMapping('1');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });
  });
});
