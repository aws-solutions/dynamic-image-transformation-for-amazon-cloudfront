// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Router, Request, Response } from 'express';
import { initializationState } from '../services/initialization';
import { CacheRegistry } from '../services/cache/cache-registry';

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
    const showCacheContents = process.env.SHOW_CACHE_CONTENTS === 'true';
    
    //Used for development to display cache contents. Output not effected when flag is ommited or false.
    let cachedContents = showCacheContents ? await getCacheContents() : null;
    
    let healthResponse = {
      ...baseResponse,
      initializationDuration: `${duration}ms`,
      completedCaches,
      ...cachedContents
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

const getCacheContents = async () => {
  const registry = CacheRegistry.getInstance();
  return {
    policies: await registry.getPolicyCache().getContents(),
    origins: await registry.getOriginCache().getContents(),
    pathMappings: await registry.getPathMappingCache().getContents(),
    headerMappings: await registry.getHeaderMappingCache().getContents()
  };
};

export default router;
