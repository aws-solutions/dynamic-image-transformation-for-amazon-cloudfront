import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import TransformationPolicyDetails from '../../pages/TransformationPolicyDetails';

const mockNavigate = vi.fn();
const mockDeletePolicy = vi.fn();
const mockToPolicies = vi.fn();

// Create mock functions that can be overridden per test
let mockUseTransformationPolicy = vi.fn();
let mockUseTypedNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-policy-id' }),
    useNavigate: () => mockNavigate
  };
});

vi.mock('../../services/authService', () => ({
  AuthService: {
    signOut: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../hooks/useTransformationPolicy', () => ({
  useTransformationPolicy: (...args: any[]) => mockUseTransformationPolicy(...args)
}));

vi.mock('../../hooks/useTypedNavigate', () => ({
  useTypedNavigate: () => mockUseTypedNavigate()
}));

vi.mock('../../contexts/TransformationPolicyContext', () => ({
  TransformationPolicyProvider: ({ children }: any) => children,
  useTransformationPolicyContext: () => ({
    deletePolicy: mockDeletePolicy
  })
}));

describe('TransformationPolicyDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockUseTransformationPolicy.mockReturnValue({
      policy: null,
      loading: true,
      error: null
    });
    
    mockUseTypedNavigate.mockReturnValue({
      toOrigins: vi.fn(),
      toMappings: vi.fn(),
      toPolicies: mockToPolicies
    });
  });

  it('should render loading state', () => {
    render(<TransformationPolicyDetails />);
    
    expect(screen.getByText('Loading transformation policy details...')).toBeInTheDocument();
  });

  it('should render breadcrumbs', () => {
    render(<TransformationPolicyDetails />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Transformation Policies')).toBeInTheDocument();
  });

  it('should render error state when policy not found', () => {
    mockUseTransformationPolicy.mockReturnValue({
      policy: null,
      loading: false,
      error: 'Policy not found'
    });

    render(<TransformationPolicyDetails />);
    
    expect(screen.getByText('Policy not found')).toBeInTheDocument();
  });

  it('should render policy details when loaded', () => {
    const mockPolicy = {
      policyId: 'test-id',
      policyName: 'Test Policy',
      description: 'Test description',
      isDefault: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
      policyJSON: {
        transformations: [],
        outputs: []
      }
    };

    mockUseTransformationPolicy.mockReturnValue({
      policy: mockPolicy,
      loading: false,
      error: null
    });

    render(<TransformationPolicyDetails />);
    
    expect(screen.getAllByText('Test Policy')).toHaveLength(3); // breadcrumb, header, metadata
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render policy with transformations', () => {
    const mockPolicy = {
      policyId: 'test-id',
      policyName: 'Test Policy',
      createdAt: '2023-01-01T00:00:00Z',
      policyJSON: {
        transformations: [
          {
            transformation: 'quality',
            value: 80,
            condition: { field: 'format', value: 'jpeg' }
          }
        ],
        outputs: []
      }
    };

    mockUseTransformationPolicy.mockReturnValue({
      policy: mockPolicy,
      loading: false,
      error: null
    });

    render(<TransformationPolicyDetails />);
    
    expect(screen.getByText(/Transformations \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('1. Quality')).toBeInTheDocument();
  });

  it('should render policy with outputs', () => {
    const mockPolicy = {
      policyId: 'test-id',
      policyName: 'Test Policy',
      createdAt: '2023-01-01T00:00:00Z',
      policyJSON: {
        transformations: [],
        outputs: [
          {
            type: 'quality',
            value: [75, [2, 999, 0.6]]
          }
        ]
      }
    };

    mockUseTransformationPolicy.mockReturnValue({
      policy: mockPolicy,
      loading: false,
      error: null
    });

    render(<TransformationPolicyDetails />);
    
    expect(screen.getByText(/Output Optimizations \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('1. Quality Optimization')).toBeInTheDocument();
  });
});
