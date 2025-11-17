// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface InitializationState {
  status: 'UNKNOWN' | 'INITIALIZING' | 'HEALTHY' | 'UNHEALTHY';
  currentStep?: string;
  completedCaches: string[];
  error?: Error;
  startTime: Date;
  completionTime?: Date;
}

export interface CacheInitializer {
  name: string;
  initialize: () => Promise<void>;
}
