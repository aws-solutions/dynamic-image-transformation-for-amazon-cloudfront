// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';

const VALID_BREAKPOINTS = new Set(['320', '480', '768', '1024', '1200', '1440', '1920']);
const MAX_DPR = 5.0;

/**
 * Applies Playground device simulation overrides to the request.
 * When authenticated Playground requests include x-dit-sim-viewport and/or x-dit-sim-dpr headers,
 * this function overwrites the dit-viewport-width and dit-dpr headers (set by the CloudFront function)
 * with the simulated values. Only valid breakpoint values and bounded DPR values are accepted.
 *
 * This must be called only after authentication is confirmed.
 */
export function applyDeviceSimulation(req: Request): void {
  const simViewport = req.headers['x-dit-sim-viewport'] as string | undefined;
  const simDpr = req.headers['x-dit-sim-dpr'] as string | undefined;

  if (simViewport && VALID_BREAKPOINTS.has(simViewport)) {
    req.headers['dit-viewport-width'] = simViewport;
  }

  if (simDpr) {
    const dpr = parseFloat(simDpr);
    if (!isNaN(dpr) && dpr > 0 && dpr <= MAX_DPR) {
      req.headers['dit-dpr'] = simDpr;
    }
  }
}

