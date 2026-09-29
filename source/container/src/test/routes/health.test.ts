// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Narrow-scoped unit test: validates status-to-HTTP-code mapping (HEALTHY→200, UNHEALTHY/INITIALIZING→503)
// and that the response body never carries cache contents.
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

  // The origin cache holds originHeaders, which carry upstream authentication credentials, and this
  // route is reachable through the CloudFront default behavior with no enforced authentication.
  // SHOW_CACHE_CONTENTS previously dumped the whole cache here; it must stay removed.
  describe('cache contents are never exposed', () => {
    const originalFlag = process.env.SHOW_CACHE_CONTENTS;

    afterEach(() => {
      if (originalFlag === undefined) {
        delete process.env.SHOW_CACHE_CONTENTS;
      } else {
        process.env.SHOW_CACHE_CONTENTS = originalFlag;
      }
    });

    it.each(['true', 'false', undefined])(
      'omits cache contents from the HEALTHY body when SHOW_CACHE_CONTENTS is %s',
      async (flag) => {
        if (flag === undefined) {
          delete process.env.SHOW_CACHE_CONTENTS;
        } else {
          process.env.SHOW_CACHE_CONTENTS = flag;
        }
        (initializationState as any).status = 'HEALTHY';
        (initializationState as any).completionTime = new Date();

        await getHandler()(mockReq, mockRes);

        expect(mockStatus).toHaveBeenCalledWith(200);
        const body = mockJson.mock.calls[0][0];
        expect(body).not.toHaveProperty('origins');
        expect(body).not.toHaveProperty('policies');
        expect(body).not.toHaveProperty('pathMappings');
        expect(body).not.toHaveProperty('headerMappings');
        expect(Object.keys(body).sort()).toEqual([
          'completedCaches',
          'initializationDuration',
          'status',
          'timestamp',
        ]);
      }
    );
  });
});
