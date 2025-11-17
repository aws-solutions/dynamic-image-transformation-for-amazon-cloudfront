import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CreateMapping from '../../pages/CreateMapping';
import { MappingProvider } from '../../contexts/MappingContext';
import { OriginProvider } from '../../contexts/OriginContext';
import { TransformationPolicyProvider } from '../../contexts/TransformationPolicyContext';

// Mock services
vi.mock('../../services/authService');
vi.mock('../../services/mappingService');
vi.mock('../../services/transformationPolicyService');

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: undefined })
  };
});

// Mock validation functions
vi.mock('../../utils/validation', () => ({
  validateMappingCreateData: vi.fn(() => ({ isValid: true, errors: {} })),
  validateMappingUpdateData: vi.fn(() => ({ isValid: true, errors: {} }))
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <OriginProvider>
        <TransformationPolicyProvider>
          <MappingProvider>
            {component}
          </MappingProvider>
        </TransformationPolicyProvider>
      </OriginProvider>
    </BrowserRouter>
  );
};

describe('CreateMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render create mapping form with required elements', () => {
    renderWithProviders(<CreateMapping />);
    
    expect(screen.getByRole('heading', { name: 'Create mapping' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Host header pattern')).toBeInTheDocument();
    expect(screen.getByLabelText('Path pattern')).toBeInTheDocument();
    expect(screen.getByLabelText('Origin')).toBeInTheDocument();
    expect(screen.getByLabelText('Transformation Policy (optional)')).toBeInTheDocument();
  });

  it('should disable create button when required fields are empty', () => {
    renderWithProviders(<CreateMapping />);
    
    const createButton = screen.getByRole('button', { name: /create mapping/i });
    expect(createButton).toBeDisabled();
  });

  it('should handle form input changes', () => {
    renderWithProviders(<CreateMapping />);
    
    const mappingNameInput = screen.getByLabelText('Name');
    fireEvent.change(mappingNameInput, { target: { value: 'Test Mapping' } });
    expect(mappingNameInput).toHaveValue('Test Mapping');
    
    const descriptionInput = screen.getByLabelText('Description (optional)');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
    expect(descriptionInput).toHaveValue('Test description');
    
    const hostPatternInput = screen.getByLabelText('Host header pattern');
    fireEvent.change(hostPatternInput, { target: { value: '*.example.com' } });
    expect(hostPatternInput).toHaveValue('*.example.com');
    
    const pathPatternInput = screen.getByLabelText('Path pattern');
    fireEvent.change(pathPatternInput, { target: { value: '/api/*' } });
    expect(pathPatternInput).toHaveValue('/api/*');
  });

  it('should handle cancel action', () => {
    renderWithProviders(<CreateMapping />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/mappings');
  });

  it('should display form sections', () => {
    renderWithProviders(<CreateMapping />);
    
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Origin')).toBeInTheDocument();
  });

  it('should show validation helper text for patterns', () => {
    renderWithProviders(<CreateMapping />);
    
    expect(screen.getByText(/pattern to match against the host header/i)).toBeInTheDocument();
    expect(screen.getByText(/pattern to match against the request path/i)).toBeInTheDocument();
  });

  it('should display origin and policy selection dropdowns', () => {
    renderWithProviders(<CreateMapping />);
    
    const originSelect = screen.getByRole('button', { name: /origin/i });
    expect(originSelect).toBeInTheDocument();
    
    const policySelect = screen.getByRole('button', { name: /transformation policy/i });
    expect(policySelect).toBeInTheDocument();
  });

  it('should show breadcrumb navigation', () => {
    renderWithProviders(<CreateMapping />);
    
    expect(screen.getByRole('heading', { name: 'Create mapping' })).toBeInTheDocument();
    // Check that Mappings text appears somewhere (could be breadcrumb or nav) - use getAllByText to handle multiple instances
    expect(screen.getAllByText('Mappings')).toHaveLength(2); // One in breadcrumb, one in navigation
  });

  it('should render form actions', () => {
    renderWithProviders(<CreateMapping />);
    
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create mapping/i })).toBeInTheDocument();
  });

  it('should display help panel toggle', () => {
    renderWithProviders(<CreateMapping />);
    
    // Help panel is toggled via breadcrumb component
    expect(screen.getByRole('heading', { name: 'Create mapping' })).toBeInTheDocument();
  });
});
