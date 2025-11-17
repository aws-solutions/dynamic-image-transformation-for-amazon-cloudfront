import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppProvider } from '../contexts/AppContext';
import { OriginProvider } from '../contexts/OriginContext';
import { MappingProvider } from '../contexts/MappingContext';
import { TransformationPolicyProvider } from '../contexts/TransformationPolicyContext';

// Mock Amplify configuration
const mockAmplifyConfig = {
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
};

// Mock Amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
    getConfig: vi.fn(() => mockAmplifyConfig)
  }
}));

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
  signOut: vi.fn(),
  fetchAuthSession: vi.fn(() => Promise.resolve({
    tokens: {
      accessToken: {
        toString: () => 'mock-access-token'
      }
    }
  }))
}));

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return (
    <BrowserRouter>
      <AppProvider>
        <OriginProvider>
          <TransformationPolicyProvider>
            <MappingProvider>
              {children}
            </MappingProvider>
          </TransformationPolicyProvider>
        </OriginProvider>
      </AppProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
