// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from '../../utils/apiClient';

vi.mock('aws-amplify', () => ({
  Amplify: {
    getConfig: vi.fn(() => ({ API: { REST: { AdminAPI: { endpoint: '/api' } } } }))
  }
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(() => Promise.reject(new Error('No session')))
}));

describe('apiClient - Base Infrastructure Reliability', () => {
  const apiClient = createApiClient();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Core Request Handling', () => {
    it('should handle network failures gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await apiClient.request('/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle successful responses with data', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"status": "ok"}')
      } as Response);

      const result = await apiClient.request('/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'ok' });
    });

    it('should handle HTTP error status codes', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      } as Response);

      const result = await apiClient.request('/error');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('should handle empty response bodies', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('')
      } as Response);

      const result = await apiClient.request('/empty');

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });

    it('should handle malformed JSON gracefully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('invalid json {')
      } as Response);

      const result = await apiClient.request('/bad-json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid json {');
    });
  });
});
