// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface MappingTestData {
  name: string;
  description?: string;
  hostHeaderPattern?: string;
  pathPattern?: string;
  origin?: string;
  policy?: string;
}

export class MappingFactory {
  static createBasicMapping(overrides: Partial<MappingTestData> = {}): MappingTestData {
    return {
      name: 'Test Mapping',
      description: 'Basic mapping for testing',
      hostHeaderPattern: 'example.com',
      origin: 'Test Origin',
      ...overrides
    };
  }

  static createHostHeaderPatternMapping(overrides: Partial<MappingTestData> = {}): MappingTestData {
    return {
      name: 'Host Header Pattern Mapping',
      description: 'Mapping with host header pattern only',
      hostHeaderPattern: '*.example.com',
      origin: 'Test Origin',
      ...overrides
    };
  }

  static createPathPatternMapping(overrides: Partial<MappingTestData> = {}): MappingTestData {
    return {
      name: 'Path Pattern Mapping',
      description: 'Mapping with path pattern only',
      pathPattern: '/images/*',
      origin: 'Test Origin',
      ...overrides
    };
  }

  static createPolicyMapping(overrides: Partial<MappingTestData> = {}): MappingTestData {
    return {
      name: 'Policy Mapping',
      description: 'Mapping with policy',
      hostHeaderPattern: 'policy.example.com',
      origin: 'Test Origin',
      policy: 'Test Policy',
      ...overrides
    };
  }
}
