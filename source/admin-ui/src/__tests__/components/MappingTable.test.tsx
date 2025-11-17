import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import { MappingTable } from '../../components/tables/MappingTable';

vi.mock('../../hooks/useTypedNavigate', () => ({
  useTypedNavigate: () => ({
    toMappingDetails: vi.fn(),
    toMappingEdit: vi.fn(),
    toMappingCreate: vi.fn()
  })
}));

// Create a variable to hold mock data that can be updated per test
let mockMappings: any[] = [];

// Mock contexts with both hooks and providers
vi.mock('../../contexts/MappingContext', () => ({
  useMappingContext: () => ({
    allMappings: mockMappings,
    selectedMappings: [],
    setSelectedMappings: vi.fn(),
    loading: false,
    hasNext: false,
    loadMore: vi.fn()
  }),
  MappingProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('../../contexts/OriginContext', () => ({
  useOriginContext: () => ({
    allOrigins: [
      { originId: 'origin-1', originName: 'Primary Origin' },
      { originId: 'origin-2', originName: 'S3 Bucket Origin' }
    ]
  }),
  OriginProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('../../contexts/TransformationPolicyContext', () => ({
  useTransformationPolicyContext: () => ({
    allPolicies: [
      { policyId: 'policy-1', policyName: 'Mobile Policy' },
      { policyId: 'policy-2', policyName: 'Desktop Policy' }
    ]
  }),
  TransformationPolicyProvider: ({ children }: { children: React.ReactNode }) => children
}));

describe('MappingTable', () => {
  const defaultProps = {
    onDeleteClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMappings.length = 0; // Reset mock data
  });

  it('should render empty state with table structure and disabled delete button', () => {
    render(<MappingTable {...defaultProps} />);
    
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Mappings (0)')).toBeInTheDocument();
    expect(screen.getByText('No mappings')).toBeInTheDocument();
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
  });

  it('should display mapping data correctly in table rows', () => {
    // Set up test data
    mockMappings.push({
      mappingId: '1',
      mappingName: 'API Mapping',
      pathPattern: '/api/*',
      hostHeaderPattern: 'api.example.com',
      originId: 'origin-1',
      policyId: 'policy-1'
    });

    render(<MappingTable {...defaultProps} />);
    
    expect(screen.getByText('API Mapping')).toBeInTheDocument();
    expect(screen.getByText('/api/*')).toBeInTheDocument();
    expect(screen.getByText('api.example.com')).toBeInTheDocument();
    expect(screen.getByText('Primary Origin')).toBeInTheDocument();
    expect(screen.getByText('Mobile Policy')).toBeInTheDocument();
  });
});
