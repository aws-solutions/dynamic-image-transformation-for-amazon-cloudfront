// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InitializationState } from './types';
import { InitializationService } from './initialization-service';

// Shared state object for health check integration
export const initializationState: InitializationState = {
  status: 'UNKNOWN',
  currentStep: undefined,
  completedCaches: [],
  error: undefined,
  startTime: new Date(),
  completionTime: undefined
};

// Main initialization function to be called from Express app
export const initializeContainer = async (): Promise<void> => {
  // Skip initialization in test mode
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_INITIALIZATION === 'true') {
    console.log('Skipping container initialization in test mode');
    initializationState.status = 'HEALTHY';
    initializationState.completionTime = new Date();
    return;
  }
  
  await InitializationService.initialize(initializationState);
};

// Export types and state for health check access
export { InitializationState } from './types';
