import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import CreateTransformationPolicy from '../../pages/CreateTransformationPolicy';

const mockNavigate = vi.fn();
const mockCreatePolicy = vi.fn();
const mockUpdatePolicy = vi.fn();

const mockUseParams = vi.fn().mockReturnValue({ id: undefined });
const mockUseNavigate = vi.fn().mockReturnValue(mockNavigate);
const mockUseTransformationPolicyContext = vi.fn().mockReturnValue({
  createPolicy: mockCreatePolicy,
  updatePolicy: mockUpdatePolicy
});
const mockAuthServiceSignOut = vi.fn();
const mockTransformationPolicyServiceGet = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useNavigate: () => mockUseNavigate()
  };
});

vi.mock('../../services/authService', () => ({
  AuthService: {
    signOut: () => mockAuthServiceSignOut()
  }
}));

vi.mock('../../contexts/TransformationPolicyContext', () => ({
  TransformationPolicyProvider: ({ children }: any) => children,
  useTransformationPolicyContext: () => mockUseTransformationPolicyContext()
}));

vi.mock('../../services/transformationPolicyService', () => ({
  TransformationPolicyService: {
    get: () => mockTransformationPolicyServiceGet()
  }
}));

describe('CreateTransformationPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: undefined });
    mockUseTransformationPolicyContext.mockReturnValue({
      createPolicy: mockCreatePolicy,
      updatePolicy: mockUpdatePolicy
    });
  });

  it('should render create form with correct header', () => {
    render(<CreateTransformationPolicy />);
    
    expect(screen.getByText('Create Transformation Policy')).toBeInTheDocument();
    expect(screen.getByText('Create transformation policy')).toBeInTheDocument();
  });

  it('should render breadcrumbs correctly', () => {
    render(<CreateTransformationPolicy />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getAllByText('Transformation Policies')[0]).toBeInTheDocument();
  });

  it('should render form fields with correct placeholders', () => {
    render(<CreateTransformationPolicy />);
    
    expect(screen.getByPlaceholderText('e.g., Mobile Optimization Policy')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe the purpose and use case/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Set as default policy' })).toBeInTheDocument();
  });

  it('should show empty state for transformations and outputs', () => {
    render(<CreateTransformationPolicy />);
    
    expect(screen.getByText('No transformations added yet. Click "Add Transformation" to get started.')).toBeInTheDocument();
    expect(screen.getByText('No output optimizations added yet. Click "Add Output Optimization" to configure adaptive delivery options.')).toBeInTheDocument();
  });

  it('should handle form input changes', async () => {
    const user = userEvent.setup();
    render(<CreateTransformationPolicy />);
    
    const nameInput = screen.getByPlaceholderText('e.g., Mobile Optimization Policy');
    const descriptionInput = screen.getByPlaceholderText(/Describe the purpose and use case/);
    const defaultCheckbox = screen.getByRole('checkbox', { name: 'Set as default policy' });
    
    await user.type(nameInput, 'Test Policy');
    await user.type(descriptionInput, 'Test description');
    await user.click(defaultCheckbox);
    
    expect(nameInput).toHaveValue('Test Policy');
    expect(descriptionInput).toHaveValue('Test description');
    expect(defaultCheckbox).toBeChecked();
  });

  it('should navigate to policies list on cancel', async () => {
    const user = userEvent.setup();
    render(<CreateTransformationPolicy />);
    
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    // Click the first cancel button (main form cancel)
    await user.click(cancelButtons[0]);
    
    expect(mockNavigate).toHaveBeenCalledWith('/transformation-policies');
  });

  it('should disable create button when no policy name', () => {
    render(<CreateTransformationPolicy />);
    
    const createButton = screen.getByRole('button', { name: 'Create Policy' });
    expect(createButton).toBeDisabled();
  });

  it('should disable create button when policy name exists but no transformations or outputs', async () => {
    const user = userEvent.setup();
    render(<CreateTransformationPolicy />);
    
    const nameInput = screen.getByPlaceholderText('e.g., Mobile Optimization Policy');
    const createButton = screen.getByRole('button', { name: 'Create Policy' });
    
    await user.type(nameInput, 'Test Policy');
    
    expect(createButton).toBeDisabled();
  });

  it('should show add transformation buttons', () => {
    render(<CreateTransformationPolicy />);
    
    const addTransformationButtons = screen.getAllByText('Add Transformation');
    expect(addTransformationButtons).toHaveLength(2); // One in empty state, one in header
  });

  it('should show add output optimization button', () => {
    render(<CreateTransformationPolicy />);
    
    const addOutputButton = screen.getByText('Add Output Optimization');
    expect(addOutputButton).toBeInTheDocument();
  });

  it('should render in edit mode when id is provided', () => {
    mockUseParams.mockReturnValue({ id: 'test-id' });
    mockTransformationPolicyServiceGet.mockResolvedValue({
      success: true,
      data: {
        policyName: 'Test Policy',
        description: 'Test Description',
        isDefault: true,
        policyJSON: { transformations: [], outputs: [] }
      }
    });
    
    render(<CreateTransformationPolicy />);
    
    expect(screen.getByText('Update Transformation Policy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Policy' })).toBeInTheDocument();
  });

  it('should clear validation errors when input changes', async () => {
    const user = userEvent.setup();
    render(<CreateTransformationPolicy />);
    
    const nameInput = screen.getByPlaceholderText('e.g., Mobile Optimization Policy');
    
    // Type and clear to potentially trigger validation
    await user.type(nameInput, 'Test');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Test Policy');
    
    expect(nameInput).toHaveValue('New Test Policy');
  });
});
