// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InitializationState, CacheInitializer } from '../../services/initialization/types';

describe('InitializationState', () => {
  it('should have correct status type values', () => {
    const validStatuses: InitializationState['status'][] = [
      'UNKNOWN',
      'INITIALIZING', 
      'HEALTHY',
      'UNHEALTHY'
    ];

    validStatuses.forEach(status => {
      const state: InitializationState = {
        status,
        completedCaches: [],
        startTime: new Date()
      };
      
      expect(state.status).toBe(status);
    });
  });

  it('should allow optional properties to be undefined', () => {
    const minimalState: InitializationState = {
      status: 'UNKNOWN',
      completedCaches: [],
      startTime: new Date()
    };

    expect(minimalState.currentStep).toBeUndefined();
    expect(minimalState.error).toBeUndefined();
    expect(minimalState.completionTime).toBeUndefined();
  });

  it('should allow all properties to be set', () => {
    const error = new Error('Test error');
    const startTime = new Date('2023-01-01T00:00:00Z');
    const completionTime = new Date('2023-01-01T00:01:00Z');

    const fullState: InitializationState = {
      status: 'HEALTHY',
      currentStep: 'Initializing Policy Cache',
      completedCaches: ['Policy Cache', 'Origin Cache'],
      error,
      startTime,
      completionTime
    };

    expect(fullState.status).toBe('HEALTHY');
    expect(fullState.currentStep).toBe('Initializing Policy Cache');
    expect(fullState.completedCaches).toEqual(['Policy Cache', 'Origin Cache']);
    expect(fullState.error).toBe(error);
    expect(fullState.startTime).toBe(startTime);
    expect(fullState.completionTime).toBe(completionTime);
  });
});

describe('CacheInitializer', () => {
  it('should have required name and initialize properties', () => {
    const mockInitialize = jest.fn().mockResolvedValue(undefined);
    
    const initializer: CacheInitializer = {
      name: 'Test Cache',
      initialize: mockInitialize
    };

    expect(initializer.name).toBe('Test Cache');
    expect(initializer.initialize).toBe(mockInitialize);
  });

  it('should allow initialize function to be async', async () => {
    const mockInitialize = jest.fn().mockResolvedValue(undefined);
    
    const initializer: CacheInitializer = {
      name: 'Async Cache',
      initialize: mockInitialize
    };

    await expect(initializer.initialize()).resolves.toBeUndefined();
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });
});
