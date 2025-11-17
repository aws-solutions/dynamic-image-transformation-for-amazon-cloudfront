// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Start MSW when enabled via environment variable
if (import.meta.env.VITE_USE_MSW === 'true') {
  worker.start({
    onUnhandledRequest: 'bypass'
  }).then(() => {
    console.log('🔶 MSW: Mock Service Worker started');
  }).catch((error) => {
    console.error('❌ MSW: Failed to start Mock Service Worker', error);
  });
}