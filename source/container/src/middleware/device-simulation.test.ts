// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { applyDeviceSimulation } from './device-simulation';

describe('applyDeviceSimulation', () => {
  const createMockReq = (headers: Record<string, string> = {}) => ({ headers }) as any;

  it.each(['320', '480', '768', '1024', '1200', '1440', '1920'])(
    'should accept valid breakpoint %s for viewport',
    (breakpoint) => {
      const req = createMockReq({ 'dit-viewport-width': '1440', 'x-dit-sim-viewport': breakpoint });
      applyDeviceSimulation(req);
      expect(req.headers['dit-viewport-width']).toBe(breakpoint);
    }
  );

  it.each(['', '999', '393', 'abc', '0', '-480'])(
    'should reject invalid viewport value "%s" and preserve original',
    (invalid) => {
      const headers: Record<string, string> = { 'dit-viewport-width': '1440' };
      headers['x-dit-sim-viewport'] = invalid;
      const req = createMockReq(headers);
      applyDeviceSimulation(req);
      expect(req.headers['dit-viewport-width']).toBe('1440');
    }
  );

  it.each(['1', '2', '2.5', '3', '5'])(
    'should accept valid DPR value %s',
    (dpr) => {
      const req = createMockReq({ 'dit-dpr': '2', 'x-dit-sim-dpr': dpr });
      applyDeviceSimulation(req);
      expect(req.headers['dit-dpr']).toBe(dpr);
    }
  );

  it.each(['0', '-1', '6', 'abc', ''])(
    'should reject invalid DPR value "%s" and preserve original',
    (invalid) => {
      const headers: Record<string, string> = { 'dit-dpr': '2' };
      headers['x-dit-sim-dpr'] = invalid;
      const req = createMockReq(headers);
      applyDeviceSimulation(req);
      expect(req.headers['dit-dpr']).toBe('2');
    }
  );

  it('should override both headers when both sim values are valid', () => {
    const req = createMockReq({
      'dit-viewport-width': '1440', 'dit-dpr': '2',
      'x-dit-sim-viewport': '480', 'x-dit-sim-dpr': '3',
    });
    applyDeviceSimulation(req);
    expect(req.headers['dit-viewport-width']).toBe('480');
    expect(req.headers['dit-dpr']).toBe('3');
  });

  it('should not modify headers when no sim headers are present', () => {
    const req = createMockReq({ 'dit-viewport-width': '1440', 'dit-dpr': '2' });
    applyDeviceSimulation(req);
    expect(req.headers['dit-viewport-width']).toBe('1440');
    expect(req.headers['dit-dpr']).toBe('2');
  });
});
