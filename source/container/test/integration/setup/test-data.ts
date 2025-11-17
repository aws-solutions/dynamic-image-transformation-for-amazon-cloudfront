// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const TEST_POLICIES = [
  {
    PK: 'resize-policy',
    Data: {
      policyName: 'Resize Policy',
      description: 'Test resize policy',
      policyJSON: '{"output":{"quality":{"type":"static","value":[[0,1,0.50],[1,2,0.75],[2,5,0.90]]},"format":"webp","autosize":{"breakpoints":[100,400,800]}},"transformations":[{"transformation":"height","value":600},{"transformation":"width","value":600},{"transformation":"fit","value":"cover"},{"transformation":"rotate","value":60,"condition":{"field":"XYZ","value":"ABC"}},{"transformation":"flip","value":true,"condition":{"field":"XYZ","value":["ABC","123","789"]}},{"transformation":"flop","value":false},{"transformation":"greyscale","value":true}]}',
      isDefault: false
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Resize Policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'crop-policy',
    Data: {
      policyName: 'Crop Policy',
      description: 'Test crop policy', 
      policyJSON: '{"output":{"quality":{"type":"static","value":[[0,1,0.50],[1,2,0.75],[2,5,0.90]]},"format":"webp","autosize":{"breakpoints":[100,400,800]}},"transformations":[{"transformation":"height","value":600},{"transformation":"width","value":600},{"transformation":"fit","value":"cover"},{"transformation":"rotate","value":60,"condition":{"field":"XYZ","value":"ABC"}},{"transformation":"flip","value":true,"condition":{"field":"XYZ","value":["ABC","123","789"]}},{"transformation":"flop","value":false},{"transformation":"greyscale","value":true}]}',
      isDefault: false
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Crop Policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'test-policy-1',
    Data: {
      policyName: 'Test Policy 1',
      description: 'Test policy for transformation resolver',
      policyJSON: JSON.stringify({
        transformations: [
          { transformation: 'quality', value: 85, source: 'policy' },
          { transformation: 'format', value: 'webp', source: 'policy' }
        ]
      }),
      isDefault: false
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Test Policy 1',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'test-policy-2',
    Data: {
      policyName: 'Test Policy 2',
      description: 'Test policy for transformation resolver',
      policyJSON: JSON.stringify({
        transformations: [
          { transformation: 'resize', value: { width: 500 }, source: 'policy' }
        ]
      }),
      isDefault: false
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Test Policy 2',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'conditional-policy',
    Data: {
      policyName: 'Conditional Policy',
      description: 'Test conditional policy',
      policyJSON: JSON.stringify({
        transformations: [
          { 
            transformation: 'format', 
            value: 'webp', 
            source: 'policy',
            condition: { 
              field: 'dit-accept',
              value: 'image/webp' 
            }
          }
        ]
      }),
      isDefault: false
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Conditional Policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'large-policy',
    Data: {
      policyName: 'Large Policy',
      description: 'Test policy with many transformations',
      policyJSON: JSON.stringify({
        transformations: Array.from({ length: 15 }, (_, i) => ({
          transformation: `transform${i}`,
          value: i * 10,
          source: 'policy'
        }))
      }),
      isDefault: false
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Large Policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'default-policy',
    Data: {
      policyName: 'Default Policy',
      description: 'Default transformation policy',
      policyJSON: JSON.stringify({
        transformations: [
          { transformation: 'quality', value: 75, source: 'policy' }
        ]
      }),
      isDefault: true
    },
    GSI1PK: 'POLICY',
    GSI1SK: 'Default Policy',
    GSI2PK: 'DEFAULT_POLICY',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
];

export const TEST_ORIGINS = [
  {
    PK: 'bucket1',
    Data: {
      originName: 'Test Bucket 1',
      originDomain: 'https://test-bucket-1.s3.amazonaws.com',
      originPath: '/images'
    },
    GSI1PK: 'ORIGIN',
    GSI1SK: 'Test Bucket 1',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'external1',
    Data: {
      originName: 'External Origin 1',
      originDomain: 'https://example.com',
      originPath: '/images'
    },
    GSI1PK: 'ORIGIN',
    GSI1SK: 'External Origin 1',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
];

export const TEST_PATH_MAPPINGS = [
  {
    PK: 'mapping1',
    Data: {
      originId: 'bucket1',
      policyId: 'resize-policy'
    },
    GSI1PK: 'PATH_MAPPING',
    GSI1SK: '/images/*',
    GSI2PK: 'ORIGIN#bucket1',
    GSI3PK: 'POLICY#resize-policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  },
  {
    PK: 'mapping2',
    Data: {
      originId: 'external1',
      policyId: 'crop-policy'
    },
    GSI1PK: 'PATH_MAPPING',
    GSI1SK: '/external/*',
    GSI2PK: 'ORIGIN#external1',
    GSI3PK: 'POLICY#crop-policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
];

export const TEST_HEADER_MAPPINGS = [
  {
    PK: 'mapping3',
    Data: {
      originId: 'bucket1',
      policyId: 'resize-policy'
    },
    GSI1PK: 'HOST_HEADER_MAPPING',
    GSI1SK: 'cdn.example.com',
    GSI2PK: 'ORIGIN#bucket1',
    GSI3PK: 'POLICY#resize-policy',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
];

export const ALL_TEST_DATA = [
  ...TEST_POLICIES,
  ...TEST_ORIGINS,
  ...TEST_PATH_MAPPINGS,
  ...TEST_HEADER_MAPPINGS
];