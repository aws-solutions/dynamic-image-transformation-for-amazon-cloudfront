// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import { Button, Container, ExpandableSection, FormField, Grid, Header, Input, KeyValuePairs, Link, Popover, RadioGroup, SpaceBetween } from '@cloudscape-design/components';
import { PageLayout } from '../components/layout/PageLayout';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { PlaygroundError } from '../components/error/FeatureErrorFallback';
import { PlaygroundHelpPanel } from '../components/help/PlaygroundHelpPanel';
import TransformationControls from '../components/playground/TransformationControls';
import HeadersEditor from '../components/playground/HeadersEditor';
import ImageDisplay from '../components/playground/ImageDisplay';
import { ROUTES } from '../constants/routes';
import { PlaygroundHeader, PlaygroundQueryParam, ServerMetrics } from '../types/playground';
import { formatBytes } from '../utils/format';

const DEVICE_PRESETS: { value: string; label: string; headers: { key: string; value: string }[] }[] = [
  { value: 'none', label: 'None', headers: [] },
  { value: 'iphone14pro', label: 'iPhone 14 Pro — Chrome (480px, DPR: 3)', headers: [
    { key: 'x-dit-sim-viewport', value: '480' }, { key: 'x-dit-sim-dpr', value: '3' },
  ]},
  { value: 'iphonese', label: 'iPhone SE — Chrome (480px, DPR: 2)', headers: [
    { key: 'x-dit-sim-viewport', value: '480' }, { key: 'x-dit-sim-dpr', value: '2' },
  ]},
  { value: 'galaxys23', label: 'Galaxy S23 — Chrome (480px, DPR: 3)', headers: [
    { key: 'x-dit-sim-viewport', value: '480' }, { key: 'x-dit-sim-dpr', value: '3' },
  ]},
  { value: 'ipadpro', label: 'iPad Pro 12.9" — Chrome (1024px, DPR: 2)', headers: [
    { key: 'x-dit-sim-viewport', value: '1024' }, { key: 'x-dit-sim-dpr', value: '2' },
  ]},
  { value: 'desktop1080', label: 'Desktop 1080p — Chrome (1920px, DPR: 1)', headers: [
    { key: 'x-dit-sim-viewport', value: '1920' }, { key: 'x-dit-sim-dpr', value: '1' },
  ]},
  { value: 'desktop4k', label: 'Desktop 4K — Chrome (1920px, DPR: 2)', headers: [
    { key: 'x-dit-sim-viewport', value: '1920' }, { key: 'x-dit-sim-dpr', value: '2' },
  ]},
];

const BROWSER_PRESETS: { value: string; label: string; headers: { key: string; value: string }[] }[] = [
  { value: 'none', label: 'None', headers: [] },
  { value: 'chrome-desktop', label: 'Chrome Desktop (WebP, AVIF)', headers: [
    { key: 'Accept', value: 'image/avif,image/webp,image/jpeg,*/*' },
  ]},
  { value: 'safari-ios', label: 'Safari iOS (WebP)', headers: [
    { key: 'Accept', value: 'image/webp,image/jpeg,*/*' },
  ]},
  { value: 'firefox-desktop', label: 'Firefox Desktop (WebP, AVIF)', headers: [
    { key: 'Accept', value: 'image/avif,image/webp,image/jpeg,*/*' },
  ]},
  { value: 'edge-desktop', label: 'Edge Desktop (WebP, AVIF)', headers: [
    { key: 'Accept', value: 'image/avif,image/webp,image/jpeg,*/*' },
  ]},
  { value: 'legacy', label: 'Legacy Browser (JPEG only)', headers: [
    { key: 'Accept', value: 'image/jpeg,*/*' },
  ]},
];

const Playground: React.FC = () => {
  const baseUrl = window.__imageProcessingDomain
    ? `https://${window.__imageProcessingDomain}`
    : '';

  const [imagePath, setImagePath] = useState('');
  const [headers, setHeaders] = useState<PlaygroundHeader[]>([
    { id: crypto.randomUUID(), key: '', value: '' },
  ]);
  const [queryParams, setQueryParams] = useState<PlaygroundQueryParam[]>([
    { id: crypto.randomUUID(), key: '', value: '' },
  ]);
  const [requestTrigger, setRequestTrigger] = useState(0);
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [devicePreset, setDevicePreset] = useState('none');
  const [browserPreset, setBrowserPreset] = useState('none');

  // Merge preset headers with manual headers for the request
  const presetHeaders: PlaygroundHeader[] = [
    ...(DEVICE_PRESETS.find((p) => p.value === devicePreset)?.headers ?? []),
    ...(BROWSER_PRESETS.find((p) => p.value === browserPreset)?.headers ?? []),
  ].map((h) => ({ id: h.key, key: h.key, value: h.value }));
  const allHeaders = [...presetHeaders, ...headers];

  const handleSendRequest = () => setRequestTrigger((prev) => prev + 1);

  const handleClearAll = () => {
    setImagePath('');
    setHeaders([{ id: crypto.randomUUID(), key: '', value: '' }]);
    setQueryParams([{ id: crypto.randomUUID(), key: '', value: '' }]);
    setRequestTrigger(0);
    setServerMetrics(null);
    setResponseTime(null);
    setDevicePreset('none');
    setBrowserPreset('none');
    setResetTrigger((prev) => prev + 1);
  };

  return (
    <PageLayout
      activeHref={ROUTES.PLAYGROUND}
      breadcrumbs={[{ text: 'Home', href: '/' }, { text: 'Playground' }]}
      helpPanel={<PlaygroundHelpPanel />}
    >
      <ErrorBoundary fallback={<PlaygroundError />}>
        <SpaceBetween size="l">
          <Header variant="h1">Playground</Header>

          <Grid gridDefinition={[{ colspan: 5 }, { colspan: 4 }]}>
            <FormField label="Image Path" description={baseUrl ? `Base URL: ${baseUrl}` : 'No image processing domain configured'}>
              <Input value={imagePath} onChange={({ detail }) => setImagePath(detail.value)} placeholder="/images/photo.jpg" />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '2px' }}>
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={handleClearAll}>Clear All</Button>
                <Button variant="primary" onClick={handleSendRequest} disabled={!imagePath.trim()}>Send Request</Button>
              </SpaceBetween>
            </div>
          </Grid>

          <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
            <SpaceBetween size="l">
              <Container header={<Header variant="h3" info={
                <Popover content="Transformations are sent as URL query parameters and override any policy transformation of the same type. For example, setting format here will override the policy's auto format negotiation." triggerType="custom">
                  <Link variant="info">Info</Link>
                </Popover>
              }>Transformations</Header>}>
                <div style={{ maxHeight: '60vh', overflowY: 'auto', marginRight: '-20px', paddingRight: '20px' }}>
                  <TransformationControls onQueryParamsChange={setQueryParams} resetTrigger={resetTrigger} />
                </div>
              </Container>
              <Container header={<Header variant="h3" info={
                <Popover content="These presets send client hint headers (DPR, viewport width, Accept) with the request. The transformation policy reads these headers and applies optimizations like format negotiation, quality adjustment, and responsive sizing. Ensure your policy has Output Optimizations configured for these to take effect." triggerType="custom">
                  <Link variant="info">Info</Link>
                </Popover>
              }>Output Optimizations</Header>}>
                <div style={{ maxHeight: '40vh', overflowY: 'auto', marginRight: '-20px', paddingRight: '20px' }}>
                <SpaceBetween size="m">
                  <ExpandableSection headerText="Client Hint Presets">
                    <SpaceBetween size="m">
                      <FormField label="Device" description="Simulates Tier 2 client detection by sending viewport and DPR headers">
                        <RadioGroup value={devicePreset} onChange={({ detail }) => setDevicePreset(detail.value)}
                          items={DEVICE_PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
                      </FormField>
                      <FormField label="Browser Format Support" description="Adds Accept header for format negotiation">
                        <RadioGroup value={browserPreset} onChange={({ detail }) => setBrowserPreset(detail.value)}
                          items={BROWSER_PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
                      </FormField>
                    </SpaceBetween>
                  </ExpandableSection>
                </SpaceBetween>
                </div>
              </Container>
              <Container header={<Header variant="h3" info={
                <Popover content="Add custom HTTP headers to the request. Use this to test specific client hint values not covered by presets, e.g. dit-dpr: 2.5 or dit-viewport-width: 500." triggerType="custom">
                  <Link variant="info">Info</Link>
                </Popover>
              }>Advanced Options</Header>}>
                <HeadersEditor headers={headers} onChange={setHeaders} />
              </Container>
            </SpaceBetween>

            <SpaceBetween size="l">
              <ImageDisplay
                url={`${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`}
                headers={allHeaders}
                queryParams={queryParams}
                requestTrigger={requestTrigger}
                onServerMetrics={setServerMetrics}
                onResponseTime={setResponseTime}
              />
              {(responseTime !== null || serverMetrics) && (
                <Container header={<Header variant="h2">Performance Metrics</Header>}>
                  <KeyValuePairs columns={2} items={[
                    ...(responseTime !== null ? [{ label: 'Client Response Time', value: `${responseTime}ms`, key: 'clientrt' }] : []),
                    ...(serverMetrics?.originFetchMs !== undefined ? [{ label: 'Origin Fetch', value: `${serverMetrics.originFetchMs}ms`, key: 'origin' }] : []),
                    ...(serverMetrics?.transformMs !== undefined ? [{ label: 'Transformation', value: `${serverMetrics.transformMs}ms`, key: 'transform' }] : []),
                    ...(serverMetrics?.totalMs !== undefined ? [{ label: 'Total Server Time', value: `${serverMetrics.totalMs}ms`, key: 'total' }] : []),
                    ...(serverMetrics?.requestId ? [{ label: 'Request ID', value: serverMetrics.requestId, key: 'requestid' }] : []),
                  ]} />
                </Container>
              )}
              {serverMetrics?.preOptimization && serverMetrics?.postOptimization && (
                <Container header={<Header variant="h2">Optimization Impact</Header>}>
                  <SpaceBetween size="m">
                    <KeyValuePairs columns={3} items={[
                      { label: 'Original Size', value: formatBytes(serverMetrics.preOptimization.size), key: 'origsize' },
                      { label: 'Output Size', value: formatBytes(serverMetrics.postOptimization.size), key: 'outsize' },
                      { label: 'Size Reduction', value: serverMetrics.preOptimization.size ? `${Math.round((1 - serverMetrics.postOptimization.size / serverMetrics.preOptimization.size) * 100)}%` : '—', key: 'sizereduction' },
                      { label: 'Original Dimensions', value: (serverMetrics.preOptimization.width != null && serverMetrics.preOptimization.height != null) ? `${serverMetrics.preOptimization.width} × ${serverMetrics.preOptimization.height}` : '—', key: 'origdim' },
                      { label: 'Output Dimensions', value: `${serverMetrics.postOptimization.width} × ${serverMetrics.postOptimization.height}`, key: 'outdim' },
                      { label: 'Compression Ratio', value: serverMetrics.compressionRatio ? `${serverMetrics.compressionRatio}:1` : '—', key: 'ratio' },
                      { label: 'Original Format', value: serverMetrics.preOptimization.format?.toUpperCase() ?? '—', key: 'origfmt' },
                      { label: 'Output Format', value: serverMetrics.postOptimization.format?.toUpperCase() ?? '—', key: 'outfmt' },
                      ...(serverMetrics.preOptimization.format && serverMetrics.postOptimization.format && serverMetrics.preOptimization.format !== serverMetrics.postOptimization.format
                        ? [{ label: 'Format Changed', value: `${serverMetrics.preOptimization.format.toUpperCase()} → ${serverMetrics.postOptimization.format.toUpperCase()}`, key: 'fmtchange' }]
                        : [{ label: 'Format Changed', value: 'No', key: 'fmtchange' }]),
                    ]} />
                  </SpaceBetween>
                </Container>
              )}
            </SpaceBetween>
          </Grid>
        </SpaceBetween>
      </ErrorBoundary>
    </PageLayout>
  );
};

export default Playground;
