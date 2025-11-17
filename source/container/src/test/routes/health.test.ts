// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Narrow-scoped unit test: Only validates status-to-HTTP-code mapping (HEALTHY→200, UNHEALTHY/INITIALIZING→503)
import { Request, Response } from 'express';

jest.mock('../../services/initialization', () => ({
  initializationState: {
    status: 'UNKNOWN',
    currentStep: undefined,
    completedCaches: [],
    error: undefined,
    startTime: new Date(),
    completionTime: undefined
  }
}));

jest.mock('../../services/cache/cache-registry', () => ({
  CacheRegistry: {
    getInstance: jest.fn().mockReturnValue({
      getPolicyCache: jest.fn().mockReturnValue({
        getContents: jest.fn().mockResolvedValue({})
      }),
      getOriginCache: jest.fn().mockReturnValue({
        getContents: jest.fn().mockResolvedValue({})
      }),
      getPathMappingCache: jest.fn().mockReturnValue({
        getContents: jest.fn().mockResolvedValue({})
      }),
      getHeaderMappingCache: jest.fn().mockReturnValue({
        getContents: jest.fn().mockResolvedValue({})
      })
    })
  }
}));

import healthRouter from '../../routes/health';
import { initializationState } from '../../services/initialization';

describe('Health Endpoint Status Codes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockReq = {};
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = { status: mockStatus };
  });

  const getHandler = () => {
    const route = (healthRouter as any).stack[0];
    return route.route.stack[0].handle;
  };

  it('returns 200 when status is HEALTHY', async () => {
    (initializationState as any).status = 'HEALTHY';
    (initializationState as any).completionTime = new Date();

    await getHandler()(mockReq, mockRes);

    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('returns 503 when status is UNHEALTHY', async () => {
    (initializationState as any).status = 'UNHEALTHY';

    await getHandler()(mockReq, mockRes);

    expect(mockStatus).toHaveBeenCalledWith(503);
  });

  it('returns 503 when status is INITIALIZING', async () => {
    (initializationState as any).status = 'INITIALIZING';

    await getHandler()(mockReq, mockRes);

    expect(mockStatus).toHaveBeenCalledWith(503);
  });
});