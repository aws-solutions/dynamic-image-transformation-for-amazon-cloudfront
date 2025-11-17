// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { http, HttpResponse } from 'msw';
import { Origin } from '@data-models';
import { Mapping } from '@data-models';
import { mockTransformationPolicies, availableTransformations } from './transformationPolicyData';
import type { TransformationPolicy } from '@data-models';

const mockOrigins: Origin[] = [
  {
    originId: '550e8400-e29b-41d4-a716-446655440001',
    originName: 'Primary Image Server',
    originDomain: 'images.example.com',
    originPath: '/api/v1',
    originHeaders: {
      'X-API-Key': 'api-key-123',
      'X-Source': 'admin-panel'
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440002',
    originName: 'S3 Bucket Origin',
    originDomain: 'my-bucket.s3.amazonaws.com',
    originHeaders: {
      'Cache-Control': 'max-age=3600'
    },
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-18T16:45:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440003',
    originName: 'CDN Origin',
    originDomain: 'cdn.example.com',
    originPath: '/images',
    createdAt: '2024-01-05T08:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440004',
    originName: 'Backup Origin Server',
    originDomain: 'backup.images.example.com',
    originPath: '/v2/api',
    originHeaders: {
      'X-Backup': 'true'
    },
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-22T10:30:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440005',
    originName: 'Media Server',
    originDomain: 'media.example.com',
    originPath: '/assets',
    originHeaders: {
      'X-Media-Type': 'images'
    },
    createdAt: '2024-01-08T11:00:00Z',
    updatedAt: '2024-01-25T09:15:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440006',
    originName: 'Static Assets Origin',
    originDomain: 'static.example.com',
    originPath: '/public',
    createdAt: '2024-01-03T16:00:00Z',
    updatedAt: '2024-01-19T13:45:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440007',
    originName: 'Development Origin',
    originDomain: 'dev.images.example.com',
    originPath: '/dev/api',
    originHeaders: {
      'X-Environment': 'development'
    },
    createdAt: '2024-01-01T12:00:00Z',
    updatedAt: '2024-01-16T10:20:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440008',
    originName: 'Test Origin Server',
    originDomain: 'test.example.com',
    originPath: '/test',
    originHeaders: {
      'X-Test-Mode': 'enabled'
    },
    createdAt: '2024-01-02T14:30:00Z',
    updatedAt: '2024-01-17T11:00:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-446655440009',
    originName: 'Production Mirror',
    originDomain: 'mirror.images.example.com',
    originPath: '/mirror',
    originHeaders: {
      'X-Mirror': 'production'
    },
    createdAt: '2024-01-06T09:45:00Z',
    updatedAt: '2024-01-21T15:30:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-4466554400010',
    originName: 'Archive Origin',
    originDomain: 'archive.example.com',
    originPath: '/archive',
    originHeaders: {
      'X-Archive-Date': '2024-01-01'
    },
    createdAt: '2024-01-04T08:15:00Z',
    updatedAt: '2024-01-18T12:45:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-4466554400011',
    originName: 'Edge Cache Origin',
    originDomain: 'edge.example.com',
    originPath: '/cache',
    originHeaders: {
      'X-Edge-Location': 'us-east-1'
    },
    createdAt: '2024-01-07T13:20:00Z',
    updatedAt: '2024-01-23T16:10:00Z'
  },
  {
    originId: '550e8400-e29b-41d4-a716-4466554400012',
    originName: 'Mobile Assets Origin',
    originDomain: 'mobile.example.com',
    originPath: '/mobile',
    originHeaders: {
      'X-Device-Type': 'mobile'
    },
    createdAt: '2024-01-09T10:30:00Z',
    updatedAt: '2024-01-24T14:20:00Z'
  }
];

const mockMappings: Mapping[] = [
  {
    mappingId: '1',
    mappingName: 'Product Images Mapping',
    description: 'Handles product catalog images with optimization',
    pathPattern: '/products/*',
    originId: '550e8400-e29b-41d4-a716-446655440001',
    policyId: '550e8400-e29b-41d4-a716-446655440001', // Mobile Optimization
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    mappingId: '2', 
    mappingName: 'User Avatars Mapping',
    description: 'User profile pictures and avatars',
    pathPattern: '/avatars/*',
    originId: '550e8400-e29b-41d4-a716-446655440002',
    createdAt: '2024-01-16T11:00:00Z',
    updatedAt: '2024-01-21T15:30:00Z'
  },
  {
    mappingId: '3',
    mappingName: 'Static Assets Mapping',
    description: 'CSS, JS, and other static resources', 
    pathPattern: '/static/*',
    originId: '550e8400-e29b-41d4-a716-446655440006',
    policyId: '550e8400-e29b-41d4-a716-446655440002', // High Quality Print
    createdAt: '2024-01-17T12:00:00Z',
    updatedAt: '2024-01-22T16:30:00Z'
  }
];

let origins = [...mockOrigins];
let mappings = [...mockMappings];

export const handlers = [
  // Origins API - match both local and full API Gateway URLs
  http.get('/api/origins', ({ request }) => {
    const url = new URL(request.url);
    const nextToken = url.searchParams.get('nextToken');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const startIndex = nextToken ? parseInt(nextToken) : 0;
    const endIndex = Math.min(startIndex + limit, origins.length);
    const paginatedOrigins = origins.slice(startIndex, endIndex);
    const hasMore = endIndex < origins.length;
    
    return HttpResponse.json({
      items: paginatedOrigins,
      nextToken: hasMore ? endIndex.toString() : undefined
    });
  }),
  
  // Add wildcard pattern for API Gateway URLs
  http.get('*/origins', ({ request }) => {
    const url = new URL(request.url);
    const nextToken = url.searchParams.get('nextToken');
    
    // Simulate pagination with smaller page size for testing
    const pageSize = 3;
    const startIndex = nextToken ? parseInt(nextToken) : 0;
    const endIndex = startIndex + pageSize;
    const paginatedOrigins = origins.slice(startIndex, endIndex);
    const hasMore = endIndex < origins.length;
    
    console.log(`MSW: Returning origins ${startIndex}-${endIndex-1} of ${origins.length}, hasMore: ${hasMore}`);
    
    return HttpResponse.json({
      items: paginatedOrigins,
      nextToken: hasMore ? endIndex.toString() : undefined
    });
  }),

  http.get('/api/origins/:id', ({ params }) => {
    const origin = origins.find(o => o.originId === params.id);
    if (!origin) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(origin);
  }),

  http.post('/api/origins', async ({ request }) => {
    const newOrigin = await request.json() as Omit<Origin, 'originId' | 'createdAt' | 'updatedAt'>;
    const origin: Origin = {
      ...newOrigin,
      originId: String(Date.now()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    origins.push(origin);
    return HttpResponse.json(origin, { status: 201 });
  }),

  http.put('/api/origins/:id', async ({ params, request }) => {
    const updates = await request.json() as Partial<Origin>;
    const index = origins.findIndex(o => o.originId === params.id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    origins[index] = {
      ...origins[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(origins[index]);
  }),

  http.delete('/api/origins/:id', ({ params }) => {
    const index = origins.findIndex(o => o.originId === params.id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    origins.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Mock all Cognito Identity Provider API calls - more comprehensive
  http.all('https://cognito-idp.*.amazonaws.com/*', async ({ request }) => {
    console.log('MSW intercepted Cognito request:', request.url);
    
    // Always return successful auth response regardless of the specific call
    return HttpResponse.json({
      AuthenticationResult: {
        AccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2huLmRldmVsb3BlciIsImVtYWlsIjoiam9obi5kZXZlbG9wZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE2MzQ1NjcwMDB9.mock',
        IdToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2huLmRldmVsb3BlciIsImVtYWlsIjoiam9obi5kZXZlbG9wZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE2MzQ1NjcwMDB9.mock',
        RefreshToken: 'mock-refresh-token-12345',
        ExpiresIn: 3600,
        TokenType: 'Bearer'
      },
      Username: 'john.developer',
      UserAttributes: [
        { Name: 'sub', Value: 'john.developer' },
        { Name: 'email', Value: 'john.developer@example.com' },
        { Name: 'name', Value: 'John Developer' },
        { Name: 'email_verified', Value: 'true' }
      ],
      // Mock client validation response
      UserPoolClient: {
        ClientId: 'mockclientid12345',
        UserPoolId: 'us-east-1_MOCKPOOL',
        ClientName: 'MockClient'
      }
    });
  }),

  // Mappings API
  http.get('/api/mappings', () => {
    console.log('[MSW] GET /api/mappings');
    return HttpResponse.json({ items: mappings, nextToken: undefined });
  }),

  // Add wildcard pattern for API Gateway mappings URLs
  http.get('*/mappings', () => {
    console.log('[MSW] GET */mappings');
    return HttpResponse.json({ items: mappings, nextToken: undefined });
  }),

  http.post('/api/mappings', async ({ request }) => {
    console.log('[MSW] POST /api/mappings');
    const newMapping = await request.json() as any;
    const mapping: Mapping = {
      mappingId: String(mappings.length + 1),
      ...newMapping,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mappings.push(mapping);
    return HttpResponse.json(mapping);
  }),

  http.get('/api/mappings/:id', ({ params }) => {
    console.log('[MSW] GET /api/mappings/:id', params.id);
    const mapping = mappings.find(m => m.mappingId === params.id);
    if (!mapping) {
      return HttpResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    return HttpResponse.json(mapping);
  }),

  // Add wildcard pattern for API Gateway mapping details URLs
  http.get('*/mappings/:id', ({ params }) => {
    console.log('[MSW] GET */mappings/:id', params.id);
    const mapping = mappings.find(m => m.mappingId === params.id);
    if (!mapping) {
      return HttpResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    return HttpResponse.json(mapping);
  }),

  http.put('/api/mappings/:id', async ({ params, request }) => {
    console.log('[MSW] PUT /api/mappings/:id', params.id);
    const updates = await request.json() as any;
    const index = mappings.findIndex(m => m.mappingId === params.id);
    if (index === -1) {
      return HttpResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    mappings[index] = {
      ...mappings[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return HttpResponse.json(mappings[index]);
  }),

  http.delete('/api/mappings/:id', ({ params }) => {
    console.log('[MSW] DELETE /api/mappings/:id', params.id);
    const index = mappings.findIndex(m => m.mappingId === params.id);
    if (index === -1) {
      return HttpResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    mappings.splice(index, 1);
    return HttpResponse.json({ success: true });
  }),

  // Mock Cognito Identity API calls
  http.all('https://cognito-identity.*.amazonaws.com/*', async ({ request }) => {
    console.log('MSW intercepted Cognito Identity request:', request.url);
    return HttpResponse.json({
      IdentityId: 'us-east-1:mock-identity-id',
      Credentials: {
        AccessKeyId: 'MOCK_ACCESS_KEY',
        SecretKey: 'MOCK_SECRET_KEY',
        SessionToken: 'MOCK_SESSION_TOKEN',
        Expiration: new Date(Date.now() + 3600000).toISOString()
      }
    });
  }),

  // Catch-all for any AWS API calls
  http.all('https://*.amazonaws.com/*', async ({ request }) => {
    console.log('MSW intercepted AWS request:', request.url);
    
    // Handle origins requests specifically
    if (request.url.includes('/origins/')) {
      const urlParts = request.url.split('/');
      const originId = urlParts[urlParts.length - 1];
      const origin = origins.find(o => o.originId === originId);
      if (!origin) {
        return new HttpResponse(null, { status: 404 });
      }
      console.log('[MSW] Returning mock origin for AWS request:', origin);
      return HttpResponse.json(origin);
    }
    
    // Handle individual policy requests
    if (request.url.match(/\/policies\/[^\/]+$/)) {
      const urlParts = request.url.split('/');
      const policyId = urlParts[urlParts.length - 1];
      const policy = mockTransformationPolicies.find(p => p.policyId === policyId);
      if (!policy) {
        return new HttpResponse(null, { status: 404 });
      }
      console.log('[MSW] Returning mock policy for AWS request:', policy);
      return HttpResponse.json(policy);
    }
    
    // Handle policies requests specifically (but not individual policy requests)
    if (request.url.includes('/policies')) {
      console.log('[MSW] Returning mock policies for AWS request');
      return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
    }
    
    return HttpResponse.json({ success: true });
  }),

  // Catch-all handler for debugging
  http.all('*', ({ request }) => {
    if (request.url.includes('policies') && !request.url.match(/\/policies\/[^\/]+$/)) {
      console.log('[MSW] Unhandled policies request:', request.url);
      return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
    }
    // Let other requests pass through
    return;
  }),

  // Transformation Policies API
  http.get('/api/policies', () => {
    console.log('[MSW] GET /api/policies');
    return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
  }),

  http.get('*/policies', () => {
    console.log('[MSW] GET */policies');
    return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
  }),

  http.get('https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/policies', () => {
    console.log('[MSW] GET API Gateway policies');
    return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
  }),

  http.get('https://*.execute-api.*.amazonaws.com/*/policies', () => {
    console.log('[MSW] GET API Gateway wildcard policies');
    return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
  }),

  http.get('*/policies', () => {
    console.log('[MSW] GET */policies');
    return HttpResponse.json({ items: mockTransformationPolicies, nextToken: undefined });
  }),

  http.get('/api/policies/:id', ({ params }) => {
    const policy = mockTransformationPolicies.find(p => p.policyId === params.id);
    if (!policy) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(policy);
  }),

  http.get('*/policies/:id', ({ params }) => {
    console.log('[MSW] GET */policies/:id', params.id);
    const policy = mockTransformationPolicies.find(p => p.policyId === params.id);
    if (!policy) {
      return new HttpResponse(null, { status: 404 });
    }
    console.log('[MSW] Returning single policy:', policy);
    return HttpResponse.json(policy);
  }),

  // Add specific handler for API Gateway URL pattern
  http.get('https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/policies/:id', ({ params }) => {
    console.log('[MSW] GET API Gateway policies/:id', params.id);
    const policy = mockTransformationPolicies.find(p => p.policyId === params.id);
    if (!policy) {
      return new HttpResponse(null, { status: 404 });
    }
    console.log('[MSW] Returning single policy from API Gateway:', policy);
    return HttpResponse.json(policy);
  }),

  http.post('/api/policies', async ({ request }) => {
    const newPolicy = await request.json() as any;
    const policy: TransformationPolicy = {
      ...newPolicy,
      policyId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    mockTransformationPolicies.push(policy);
    return HttpResponse.json(policy);
  }),

  http.post('*/policies', async ({ request }) => {
    const newPolicy = await request.json() as any;
    const policy: TransformationPolicy = {
      ...newPolicy,
      policyId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    mockTransformationPolicies.push(policy);
    return HttpResponse.json(policy);
  }),

  // Get single transformation policy
  http.get('/api/policies/:id', ({ params }) => {
    const { id } = params;
    const policy = mockTransformationPolicies.find(p => p.policyId === id);
    
    if (!policy) {
      return HttpResponse.json({ error: 'Policy not found' }, { status: 404 });
    }
    
    return HttpResponse.json(policy);
  }),

  // Update transformation policy
  http.put('/api/policies/:id', async ({ params, request }) => {
    const { id } = params;
    const updatedPolicy = await request.json() as TransformationPolicyCreate;
    
    const existingPolicyIndex = mockTransformationPolicies.findIndex(p => p.policyId === id);
    if (existingPolicyIndex === -1) {
      return HttpResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const policy: TransformationPolicy = {
      policyId: id as string,
      policyName: updatedPolicy.policyName,
      description: updatedPolicy.description,
      isDefault: updatedPolicy.isDefault,
      policyJSON: updatedPolicy.policyJSON,
      createdAt: mockTransformationPolicies[existingPolicyIndex].createdAt,
      updatedAt: new Date().toISOString()
    };

    mockTransformationPolicies[existingPolicyIndex] = policy;
    return HttpResponse.json(policy);
  }),

  // Available transformations endpoint
  http.get('/api/transformations', () => {
    console.log('[MSW] GET /api/transformations');
    return HttpResponse.json(availableTransformations);
  }),

  http.get('*/transformations', () => {
    console.log('[MSW] GET */transformations');
    return HttpResponse.json(availableTransformations);
  }),
];