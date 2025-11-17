// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Test fixtures to reduce duplication across tests

export const TEST_USER = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin' as const
};

export const TEST_NOTIFICATION = {
  type: 'success' as const,
  message: 'Test notification'
};

export const TEST_ORIGIN = {
  originId: 'origin-123',
  originName: 'Test Origin',
  originDomain: 'test.example.com',
  originPath: '/api',
  originHeaders: {},
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

export const TEST_MAPPING = {
  mappingId: 'test-mapping-id',
  name: 'Test Mapping',
  originId: 'origin-123',
  createdAt: '2024-01-01T00:00:00Z'
};

export const TEST_POLICY = {
  policyId: 'policy-456',
  policyName: 'Test Policy',
  description: 'Test policy description',
  isDefault: false,
  policyJSON: { transformations: [] },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

export const MOCK_ORIGINS = [
  {
    originId: '1',
    originName: 'Test Origin 1',
    originDomain: 'test1.com',
    originPath: '/test1',
    originHeaders: {}
  },
  {
    originId: '2',
    originName: 'Test Origin 2',
    originDomain: 'test2.com',
    originPath: '/test2',
    originHeaders: {}
  }
];

export const MOCK_MAPPINGS = [
  {
    mappingId: '1',
    name: 'Test Mapping 1',
    originId: '1',
    createdAt: '2023-01-01'
  },
  {
    mappingId: '2',
    name: 'Test Mapping 2',
    originId: '2',
    createdAt: '2023-01-02'
  }
];

export const MOCK_POLICIES = [
  {
    policyId: '1',
    policyName: 'Mobile Optimization',
    description: 'Optimized for mobile devices',
    isDefault: true,
    policyJSON: { transformations: [] },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    policyId: '2',
    policyName: 'Desktop Quality',
    description: 'High quality for desktop viewing',
    isDefault: false,
    policyJSON: { transformations: [] },
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }
];

// API Response fixtures
export const MOCK_API_RESPONSES = {
  origins: {
    success: { success: true, data: { origins: MOCK_ORIGINS } },
    empty: { success: true, data: { origins: [] } },
    error: new Error('Failed to fetch origins')
  },
  mappings: {
    success: { success: true, data: { mappings: MOCK_MAPPINGS } },
    empty: { success: true, data: { mappings: [] } },
    error: new Error('Failed to fetch mappings')
  },
  policies: {
    success: { success: true, data: { items: MOCK_POLICIES } },
    empty: { success: true, data: { items: [] } },
    error: new Error('Failed to fetch policies')
  }
};

// Component-specific fixtures
export const MOCK_TRANSFORMATION_OPTIONS = [
  {
    id: 'quality',
    title: 'Quality',
    description: 'Adjust image quality'
  },
  {
    id: 'resize',
    title: 'Resize',
    description: 'Resize image dimensions'
  }
];

export const MOCK_OUTPUT_OPTIONS = [
  {
    id: 'format',
    title: 'Format',
    description: 'Change image format'
  },
  {
    id: 'quality',
    title: 'Quality',
    description: 'Adjust output quality'
  }
];
