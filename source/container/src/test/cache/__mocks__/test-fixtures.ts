// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Sample test data for cache tests - Raw DDB record
export const mockPolicyRecord = {
  policyId: 'test-policy-1',
  policyName: 'Test Policy',
  description: 'Test transformation policy',
  policyJSON: '{"outputs":[{"type":"quality","value":[75,[0,1,1],[1,2,75],[2,100,90]]},{"type":"format","value":"auto"},{"type":"autosize","value":[320,480,640,960,1440,1920]}],"transformations":[{"transformation":"height","value":600},{"transformation":"width","value":600},{"transformation":"fit","value":"cover"},{"transformation":"rotate","value":60,"condition":{"field":"XYZ","value":"ABC"}},{"transformation":"flip","value":true,"condition":{"field":"XYZ","value":["ABC","123","789"]}},{"transformation":"flop","value":false},{"transformation":"greyscale","value":true}]}',
  isDefault: false
};

// Parsed policy for cache
export const mockPolicy = {
  policyId: 'test-policy-1',
  policyName: 'Test Policy',
  description: 'Test transformation policy',
  transformations: [
    { type: 'height', value: 600, source: 'policy' as const },
    { type: 'width', value: 600, source: 'policy' as const },
    { type: 'fit', value: 'cover', source: 'policy' as const },
    { type: 'rotate', value: 60, source: 'policy' as const, conditional: { target: 'XYZ', operator: 'equals' as const, value: 'ABC' } },
    { type: 'flip', value: true, source: 'policy' as const, conditional: { target: 'XYZ', operator: 'isIn' as const, value: ['ABC', '123', '789'] } },
    { type: 'flop', value: false, source: 'policy' as const },
    { type: 'greyscale', value: true, source: 'policy' as const }
  ],
  outputs: [
    {
      type: "quality" as const,
      value: [75, [0, 1, 1], [1, 2, 75], [2, 100, 90]] as [number, ...[number, number, number][]]
    },
    {
      type: "format" as const,
      value: "auto"
    },
    {
      type: "autosize" as const,
      value: [320, 480, 640, 960, 1440, 1920]
    }
  ],
  isDefault: false
};

export const mockOrigin = {
  originId: 'test-origin-1',
  originName: 'Test Origin',
  originDomain: 'example.com',
  originPath: '/images',
  originHeaders: {} as Record<string, string>
};

// Mock data as it would be stored in DynamoDB
export const mockOriginDynamoDB = {
  PK: 'test-origin-1',
  Data: {
    originName: 'Test Origin',
    originDomain: 'example.com',
    originPath: '/images',
    originHeaders: {}
  },
  GSI1PK: 'ORIGIN',
  GSI1SK: 'Test Origin'
};

export const mockPathMapping = {
  pathPattern: '/images/products',
  originId: 'test-origin-1',
  policyId: 'test-policy-1'
};

// Mock data as it would be stored in DynamoDB
export const mockPathMappingDynamoDB = {
  PK: 'mapping-1',
  Data: {
    originId: 'test-origin-1',
    policyId: 'test-policy-1'
  },
  GSI1PK: 'PATH_MAPPING',
  GSI1SK: '/images/products',
  GSI2PK: 'ORIGIN#test-origin-1',
  GSI3PK: 'POLICY#test-policy-1'
};

export const mockHeaderMapping = {
  hostPattern: 'api.example.com',
  originId: 'test-origin-1',
  policyId: 'test-policy-1'
};

// Helper to create variations of test data
export const createMockPolicy = (overrides: Partial<typeof mockPolicy> = {}) => ({
  ...mockPolicy,
  ...overrides
});

export const createMockPolicyRecord = (overrides: Partial<typeof mockPolicyRecord> = {}) => ({
  ...mockPolicyRecord,
  ...overrides
});

export const createMockOrigin = (overrides: any = {}) => ({
  ...mockOrigin,
  ...overrides,
  originHeaders: {
    ...mockOrigin.originHeaders,
    ...overrides.originHeaders
  }
});

export const createMockPathMapping = (overrides: any = {}) => ({
  ...mockPathMapping,
  ...overrides
});

// Mock data as it would be stored in DynamoDB (plain object that gets marshalled)
export const mockHeaderMappingDynamoDB = {
  PK: 'mapping-2',
  Data: {
    originId: 'test-origin-1',
    policyId: 'test-policy-1'
  },
  GSI1PK: 'HOST_HEADER_MAPPING',
  GSI1SK: 'api.example.com',
  GSI2PK: 'ORIGIN#test-origin-1',
  GSI3PK: 'POLICY#test-policy-1'
};

export const createMockHeaderMapping = (overrides: any = {}) => ({
  ...mockHeaderMapping,
  ...overrides
});