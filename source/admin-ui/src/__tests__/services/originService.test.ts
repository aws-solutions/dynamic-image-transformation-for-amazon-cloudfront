// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OriginService } from '../../services/originService';
import { TEST_ORIGIN, MOCK_ORIGINS } from '../fixtures';

const mockFetch = vi.fn();

// Mock Amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    getConfig: () => ({
      API: {
        REST: {
          AdminAPI: {
            endpoint: 'https://test-api.execute-api.us-east-1.amazonaws.com/prod'
          }
        }
      }
    })
  }
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      accessToken: {
        toString: () => 'mock-access-token'
      }
    }
  })
}));

describe('OriginService', () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe('getOrigins', () => {
    it('should fetch origins successfully', async () => {
      const mockBackendResponse = {
        items: [
          { id: '1', name: 'Test Origin 1', domain: 'test1.com', status: 'active' },
          { id: '2', name: 'Test Origin 2', domain: 'test2.com', status: 'active' }
        ],
        nextToken: 'token123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockBackendResponse))
      });

      const result = await OriginService.getOrigins();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        origins: mockBackendResponse.items,
        nextToken: mockBackendResponse.nextToken
      });
    });

    it('should handle filters and pagination', async () => {
      const mockBackendResponse = {
        items: [{ id: '1', name: 'Test Origin', domain: 'test.com', status: 'active' }],
        nextToken: 'nextToken123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockBackendResponse))
      });

      await OriginService.getOrigins({ nextToken: 'token123' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.execute-api.us-east-1.amazonaws.com/prod/origins?nextToken=token123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('')
      });

      const result = await OriginService.getOrigins();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });
  });

  describe('createOrigin', () => {
    it('should create origin successfully', async () => {
      const validOrigin = {
        name: 'Test Origin',
        domain: 'test.com',
        status: 'active' as const
      };

      const mockResponse = { id: '1', ...validOrigin };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await OriginService.createOrigin(validOrigin);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle API error response', async () => {
      const validOrigin = {
        name: 'Test Origin',
        domain: 'test.com',
        status: 'active' as const
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('')
      });

      const result = await OriginService.createOrigin(validOrigin);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 400: Bad Request');
    });
  });

  describe('updateOrigin', () => {
    it('should update origin successfully', async () => {
      const validUpdates = {
        name: 'Updated Origin',
        domain: 'updated.com',
        status: 'active' as const
      };

      const mockResponse = { id: '1', ...validUpdates };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await OriginService.updateOrigin('1', validUpdates);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle 404 error', async () => {
      const validUpdates = {
        name: 'Updated Origin',
        domain: 'updated.com',
        status: 'active' as const
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('')
      });

      const result = await OriginService.updateOrigin('1', validUpdates);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });
  });

  describe('deleteOrigin', () => {
    it('should delete origin successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('')
      });

      const result = await OriginService.deleteOrigin('1');

      expect(result.success).toBe(true);
    });

    it('should handle 404 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('')
      });

      const result = await OriginService.deleteOrigin('1');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });
  });

  describe('getOrigin', () => {
    it('should fetch single origin successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(TEST_ORIGIN))
      });

      const result = await OriginService.getOrigin('1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(TEST_ORIGIN);
    });
  });

  describe('testOrigin', () => {
    it('should test origin connectivity successfully', async () => {
      const mockResponse = { success: true, message: 'Origin is reachable', responseTime: 150 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await OriginService.testOrigin('1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });
});
