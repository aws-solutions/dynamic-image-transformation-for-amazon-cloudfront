// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { useState, useEffect, useRef } from 'react';
import { Container, Header, SpaceBetween, Box, Alert, Spinner, KeyValuePairs, ExpandableSection, Button, Link } from '@cloudscape-design/components';
import { fetchAuthSession } from 'aws-amplify/auth';
import { PlaygroundHeader, PlaygroundQueryParam, ServerMetrics } from '../../types/playground';
import { formatBytes } from '../../utils/format';

interface ImageDisplayProps {
  url: string;
  headers: PlaygroundHeader[];
  queryParams: PlaygroundQueryParam[];
  requestTrigger?: number;
  onServerMetrics?: (metrics: ServerMetrics | null) => void;
  onResponseTime?: (ms: number) => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ url, headers, queryParams, requestTrigger, onServerMetrics, onResponseTime }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [loading, setLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const urlRef = useRef(url);
  const headersRef = useRef(headers);
  const queryParamsRef = useRef(queryParams);
  urlRef.current = url;
  headersRef.current = headers;
  queryParamsRef.current = queryParams;
  const onServerMetricsRef = useRef(onServerMetrics);
  onServerMetricsRef.current = onServerMetrics;
  const onResponseTimeRef = useRef(onResponseTime);
  onResponseTimeRef.current = onResponseTime;
  const [imageInfo, setImageInfo] = useState<{
    naturalWidth?: number; naturalHeight?: number;
    fileSize?: string; fileSizeBytes?: number;
    format?: string;
  }>({});
  const [serverMetrics, setServerMetrics] = useState<{
    requestId?: string; originFetchMs?: number; transformMs?: number; totalMs?: number;
  } | null>(null);

  const createRequestUrl = () => {
    try {
      const urlObj = new URL(urlRef.current);
      queryParamsRef.current.forEach((p) => {
        if (p.key && p.value) urlObj.searchParams.set(p.key, p.value);
      });
      return urlObj.toString();
    } catch {
      return urlRef.current;
    }
  };

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!requestTrigger) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setImageUrl(null);
    setImageLoaded(false);
    setImageError(false);
    setErrorMessage('');
    setImageInfo({});
    setResponseTime(null);
    setServerMetrics(null);
    setHasAttemptedLoad(true);
    setLoading(true);

    const fetchImage = async () => {
      try {
        // Add custom headers first, then auth header last so it can't be overridden
        const requestHeaders: Record<string, string> = {};
        headersRef.current.forEach((h) => {
          if (h.key && h.value) requestHeaders[h.key] = h.value;
        });
        try {
          const session = await fetchAuthSession();
          if (session.tokens?.accessToken) {
            requestHeaders['X-DIT-Authorization'] = `Bearer ${session.tokens.accessToken.toString()}`;
          }
        } catch {
          // Graceful degradation — proceed without auth token
        }

        const finalUrl = createRequestUrl();
        const startTime = performance.now();
        // Bypass CloudFront shared cache so authenticated requests always reach origin with metrics
        const fetchUrl = `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
        const response = await fetch(fetchUrl, { method: 'GET', headers: requestHeaders, signal: controller.signal });
        const clientResponseTime = Math.round(performance.now() - startTime);
        setResponseTime(clientResponseTime);
        onResponseTimeRef.current?.(clientResponseTime);

        if (!response.ok) {
          let msg = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorBody = await response.json();
            msg = errorBody.message || errorBody.error || msg;
          } catch {}
          setImageError(true);
          setErrorMessage(msg);
          setLoading(false);
          return;
        }

        // Extract server metrics from X-DIT-Metrics header
        const metricsHeader = response.headers.get('x-dit-metrics');
        if (metricsHeader) {
          try {
            const raw = JSON.parse(metricsHeader);
            const metrics = {
              requestId: raw.requestId,
              originFetchMs: raw.timings?.originFetchMs ?? raw.originFetchMs,
              transformMs: raw.timings?.transformationApplicationMs ?? raw.transformMs,
              totalMs: raw.timings?.totalRequestMs ?? raw.totalMs,
              preOptimization: raw.preOptimization,
              postOptimization: raw.postOptimization,
              compressionRatio: raw.compressionRatio,
            };
            setServerMetrics(metrics);
            onServerMetricsRef.current?.(metrics);
          } catch {
            onServerMetricsRef.current?.(null);
          }
        } else {
          onServerMetricsRef.current?.(null);
        }

        // Extract metadata
        const contentType = response.headers.get('content-type');
        const contentLength = Number(response.headers.get('content-length')) || undefined;
        const format = contentType?.split('/')[1]?.split(';')[0]?.toUpperCase();

        setImageInfo((prev) => ({
          ...prev,
          fileSize: contentLength ? formatBytes(contentLength) : undefined,
          fileSizeBytes: contentLength,
          format,
        }));

        // Convert to blob URL for display
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setImageUrl(objectUrl);
        setLoading(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setImageError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch image');
        setLoading(false);
      }
    };

    fetchImage();

    return () => { controller.abort(); };
  }, [requestTrigger]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setImageLoaded(true);
    setImageInfo((prev) => ({ ...prev, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }));
  };

  const openInNewTab = () => window.open(createRequestUrl(), '_blank');
  const copyToClipboard = async () => { try { await navigator.clipboard.writeText(createRequestUrl()); } catch {} };

  const imageDetails = [
    ...(imageInfo.naturalWidth ? [{ label: 'Dimensions', value: `${imageInfo.naturalWidth} × ${imageInfo.naturalHeight} pixels`, key: 'dimensions' }] : []),
    ...(imageInfo.fileSize ? [{ label: 'File Size', value: imageInfo.fileSize, key: 'filesize' }] : []),
    ...(imageInfo.format ? [{ label: 'Format', value: imageInfo.format, key: 'format' }] : []),
  ];

  return (
    <Container header={<Header variant="h2">Image Result</Header>}>
      <SpaceBetween size="m">
        {!hasAttemptedLoad ? (
          <Box textAlign="center" padding="xxl">
            <Alert type="info" header="No Image Loaded">
              Enter an image path, configure transformations or presets, then click "Send Request". Click the info icon in the top-right corner of the page to open the help panel for detailed usage instructions.
            </Alert>
          </Box>
        ) : (
          <>
            <Box textAlign="center">
              {loading && (
                <Box padding="xl"><Spinner size="large" /><Box variant="p" padding={{ top: 's' }}>Loading image...</Box></Box>
              )}
              {imageError && (
                <Alert type="warning" header="Image Load Error"
                  action={
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button onClick={openInNewTab} iconName="external">Open in New Tab</Button>
                      <Button onClick={copyToClipboard} iconName="copy">Copy URL</Button>
                    </SpaceBetween>
                  }>
                  {errorMessage || 'The image cannot be displayed. This may be due to CORS restrictions or an invalid URL.'}
                  <Box padding={{ top: 's' }}><Link href={createRequestUrl()} external>{createRequestUrl()}</Link></Box>
                </Alert>
              )}
              {imageUrl && !imageError && (
                <img src={imageUrl} onLoad={handleImageLoad}
                  style={{ maxWidth: '100%', height: 'auto', display: imageLoaded ? 'block' : 'none',
                    margin: '0 auto', border: '1px solid #e9ebed', borderRadius: '8px' }}
                  alt="Dynamic Image Transformation Result" />
              )}
            </Box>
            {imageDetails.length > 0 && (
              <ExpandableSection headerText="Image Details" defaultExpanded>
                <KeyValuePairs columns={2} items={imageDetails} />
              </ExpandableSection>
            )}
          </>
        )}
      </SpaceBetween>
    </Container>
  );
};

export default ImageDisplay;
