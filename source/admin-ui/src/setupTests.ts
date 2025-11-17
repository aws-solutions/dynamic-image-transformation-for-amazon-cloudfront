// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

// Global mocks
global.fetch = vi.fn();

// Mock Amplify globally
vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
    getConfig: vi.fn(() => ({
      Auth: {
        Cognito: {
          userPoolId: 'test-pool-id',
          userPoolClientId: 'test-client-id',
          identityPoolId: 'test-identity-pool-id',
        }
      },
      API: {
        REST: {
          'AdminAPI': {
            endpoint: 'https://test-api.execute-api.us-east-1.amazonaws.com/prod',
            region: 'us-east-1'
          }
        }
      }
    }))
  }
}));

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({
    userId: 'testuser123',
    username: 'testuser123',
    attributes: {
      email: 'test@example.com',
      name: 'Test User',
      'custom:role': 'admin'
    }
  })),
  signOut: vi.fn(() => Promise.resolve()),
  fetchAuthSession: vi.fn(() => Promise.resolve({
    tokens: {
      accessToken: {
        toString: () => 'mock-access-token'
      }
    }
  }))
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});