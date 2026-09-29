// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ImageDisplay from '../../components/playground/ImageDisplay';

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: { accessToken: { toString: () => 'mock-token' } } }),
}));

const mockBlobUrl = 'blob:http://localhost/mock-image';
global.URL.createObjectURL = vi.fn(() => mockBlobUrl);
global.URL.revokeObjectURL = vi.fn();

describe('ImageDisplay - fetch and metrics extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass custom headers to fetch request', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(new Blob(['img']), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));

    render(
      <ImageDisplay
        url="https://cdn.example.com/image.jpg"
        headers={[{ id: '1', key: 'dit-dpr', value: '3' }, { id: '2', key: 'dit-viewport-width', value: '393' }]}
        queryParams={[{ id: '3', key: '', value: '' }]}
        requestTrigger={1}
      />
    );

    await waitFor(() => {
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://cdn.example.com/image.jpg');
      expect(calledUrl).toMatch(/_cb=\d+/);
      expect(fetchSpy.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({ 'dit-dpr': '3', 'dit-viewport-width': '393' }),
        })
      );
    });
  });

  it('should append query params to the request URL', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(new Blob(['img']), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    }));

    render(
      <ImageDisplay
        url="https://cdn.example.com/image.jpg"
        headers={[{ id: '1', key: '', value: '' }]}
        queryParams={[
          { id: 'w', key: 'resize.width', value: '400' },
          { id: 'f', key: 'format', value: 'webp' },
        ]}
        requestTrigger={1}
      />
    );

    await waitFor(() => {
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('resize.width=400');
      expect(calledUrl).toContain('format=webp');
      expect(calledUrl).toMatch(/_cb=\d+/);
    });
  });

  it('should use a unique _cb value per request', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(new Blob(['img']), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));

    const { rerender } = render(
      <ImageDisplay
        url="https://cdn.example.com/image.jpg"
        headers={[{ id: '1', key: '', value: '' }]}
        queryParams={[{ id: '1', key: '', value: '' }]}
        requestTrigger={1}
      />
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    rerender(
      <ImageDisplay
        url="https://cdn.example.com/image.jpg"
        headers={[{ id: '1', key: '', value: '' }]}
        queryParams={[{ id: '1', key: '', value: '' }]}
        requestTrigger={2}
      />
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    const cb1 = (fetchSpy.mock.calls[0][0] as string).match(/_cb=(\d+)/)?.[1];
    const cb2 = (fetchSpy.mock.calls[1][0] as string).match(/_cb=(\d+)/)?.[1];
    expect(cb1).not.toBe(cb2);
  });

  it('should extract optimization metrics from x-dit-metrics header', async () => {
    const serverPayload = {
      requestId: 'req-123',
      timings: { originFetchMs: 50, transformationApplicationMs: 30, totalRequestMs: 85 },
      preOptimization: { width: 4000, height: 3000, size: 2400000, format: 'jpeg' },
      postOptimization: { width: 393, height: 295, size: 18500, format: 'webp' },
      compressionRatio: 129.73,
    };

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(new Blob(['img']), {
      status: 200,
      headers: { 'content-type': 'image/webp', 'x-dit-metrics': JSON.stringify(serverPayload) },
    }));

    const onServerMetrics = vi.fn();
    render(
      <ImageDisplay
        url="https://cdn.example.com/image.jpg"
        headers={[{ id: '1', key: '', value: '' }]}
        queryParams={[{ id: '1', key: '', value: '' }]}
        requestTrigger={1}
        onServerMetrics={onServerMetrics}
      />
    );

    await waitFor(() => {
      expect(onServerMetrics).toHaveBeenCalledWith({
        requestId: 'req-123',
        originFetchMs: 50,
        transformMs: 30,
        totalMs: 85,
        preOptimization: serverPayload.preOptimization,
        postOptimization: serverPayload.postOptimization,
        compressionRatio: 129.73,
      });
    });
  });

  it('should call onServerMetrics with null when header is absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(new Blob(['img']), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));

    const onServerMetrics = vi.fn();
    render(
      <ImageDisplay
        url="https://cdn.example.com/image.jpg"
        headers={[{ id: '1', key: '', value: '' }]}
        queryParams={[{ id: '1', key: '', value: '' }]}
        requestTrigger={1}
        onServerMetrics={onServerMetrics}
      />
    );

    await waitFor(() => {
      expect(onServerMetrics).toHaveBeenCalledWith(null);
    });
  });

  it('should handle HTTP error responses gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
    }));

    render(
      <ImageDisplay
        url="https://cdn.example.com/missing.jpg"
        headers={[{ id: '1', key: '', value: '' }]}
        queryParams={[{ id: '1', key: '', value: '' }]}
        requestTrigger={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Image Load Error')).toBeDefined();
    });
  });

});
