// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock child components to isolate Playground logic
vi.mock('../../components/playground/TransformationControls', () => ({
  default: ({ onQueryParamsChange }: any) => {
    React.useEffect(() => { onQueryParamsChange([{ id: '1', key: '', value: '' }]); }, []);
    return <div data-testid="transformation-controls" />;
  },
}));
vi.mock('../../components/playground/HeadersEditor', () => ({
  default: () => <div data-testid="headers-editor" />,
}));
vi.mock('../../components/layout/PageLayout', () => ({
  PageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../../components/error/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../../components/error/FeatureErrorFallback', () => ({
  PlaygroundError: () => <div />,
}));
vi.mock('../../components/help/PlaygroundHelpPanel', () => ({
  PlaygroundHelpPanel: () => <div />,
}));

// Mock ImageDisplay to simulate onServerMetrics callback
let capturedOnServerMetrics: any;
let capturedOnResponseTime: any;
vi.mock('../../components/playground/ImageDisplay', () => ({
  default: ({ onServerMetrics, onResponseTime }: any) => {
    capturedOnServerMetrics = onServerMetrics;
    capturedOnResponseTime = onResponseTime;
    return <div data-testid="image-display" />;
  },
}));

import Playground from '../../pages/Playground';

describe('Playground - Optimization Impact panel', () => {
  beforeEach(() => {
    capturedOnServerMetrics = null;
    capturedOnResponseTime = null;
    window.__imageProcessingDomain = 'cdn.example.com';
  });

  it('should not render Optimization Impact when serverMetrics is null', async () => {
    render(<Playground />);
    act(() => { capturedOnServerMetrics(null); });

    await waitFor(() => {
      expect(screen.queryByText('Optimization Impact')).toBeNull();
    });
  });

  it('should render Optimization Impact with correct values when metrics are present', async () => {
    render(<Playground />);

    act(() => {
      capturedOnResponseTime(120);
      capturedOnServerMetrics({
        requestId: 'req-1',
        originFetchMs: 50,
        transformMs: 30,
        totalMs: 85,
        preOptimization: { width: 4000, height: 3000, size: 2000000, format: 'jpeg' },
        postOptimization: { width: 400, height: 300, size: 50000, format: 'webp' },
        compressionRatio: 40,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Optimization Impact')).toBeDefined();
      expect(screen.getByText('1.91 MB')).toBeDefined(); // Original Size
      expect(screen.getByText('48.83 KB')).toBeDefined(); // Output Size
      expect(screen.getByText('98%')).toBeDefined(); // Size Reduction
      expect(screen.getByText('4000 × 3000')).toBeDefined(); // Original Dimensions
      expect(screen.getByText('400 × 300')).toBeDefined(); // Output Dimensions
      expect(screen.getByText('40:1')).toBeDefined(); // Compression Ratio
      expect(screen.getByText('JPEG → WEBP')).toBeDefined(); // Format Changed
    });
  });

  it('should not render Optimization Impact when only timing metrics are present', async () => {
    render(<Playground />);

    act(() => {
      capturedOnResponseTime(100);
      capturedOnServerMetrics({
        requestId: 'req-2',
        originFetchMs: 50,
        transformMs: 30,
        totalMs: 85,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Performance Metrics')).toBeDefined();
      expect(screen.queryByText('Optimization Impact')).toBeNull();
    });
  });
});
