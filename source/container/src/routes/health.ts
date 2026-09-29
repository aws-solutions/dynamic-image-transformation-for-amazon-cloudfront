// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Router, Request, Response } from 'express';
import { initializationState } from '../services/initialization';

const router = Router();
// Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  const { status, currentStep, completedCaches, error, startTime, completionTime } = initializationState;
  
  const baseResponse = {
    timestamp: new Date().toISOString(),
    status,
  };

  if (status === 'HEALTHY') {
    const duration = completionTime ? completionTime.getTime() - startTime.getTime() : 0;

    // Cache contents are deliberately not exposed here. The origin cache holds originHeaders, which
    // carry upstream authentication credentials, and this route is reachable through the CloudFront
    // default behavior with no enforced authentication.
    let healthResponse = {
      ...baseResponse,
      initializationDuration: `${duration}ms`,
      completedCaches,
    };

    return res.status(200).json(healthResponse);
  }

  if (status === 'INITIALIZING') {
    return res.status(503).json({
      ...baseResponse,
      currentStep,
      completedCaches,
    });
  }

  if (status === 'UNHEALTHY') {
    return res.status(503).json({
      ...baseResponse,
      error: error?.message,
      completedCaches,
    });
  }

  // UNKNOWN status (default)
  return res.status(503).json({
    ...baseResponse,
    message: 'Container initialization not started',
  });
});

export default router;
