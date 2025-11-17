import { TEST_USER, TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import CreateTransformationPolicy from '../../pages/CreateTransformationPolicy';

vi.mock('../../../utils/user', () => ({
  getCurrentUser: () => ({ name: TEST_USER.name, email: TEST_USER.email }),
  handleSignOut: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
  };
});

describe('CreateTransformationPolicy Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable submit button when policy name is empty', async () => {
    render(<CreateTransformationPolicy />);
    
    const submitButton = screen.getByRole('button', { name: 'Create Policy' });
    expect(submitButton).toBeDisabled();
  });

  it('should show policy name input field with correct placeholder', async () => {
    render(<CreateTransformationPolicy />);
    
    const nameInput = screen.getByPlaceholderText('e.g., Mobile Optimization Policy');
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue('');
  });

  it('should validate policy name is required', async () => {
    const user = userEvent.setup();
    render(<CreateTransformationPolicy />);
    
    const nameInput = screen.getByPlaceholderText('e.g., Mobile Optimization Policy');
    const submitButton = screen.getByRole('button', { name: 'Create Policy' });
    
    // Initially disabled
    expect(submitButton).toBeDisabled();
    
    // Type and clear to trigger validation
    await user.type(nameInput, 'Test');
    await user.clear(nameInput);
    
    // Should still be disabled
    expect(submitButton).toBeDisabled();
  });

  it('should show description field with correct placeholder', async () => {
    render(<CreateTransformationPolicy />);
    
    const descriptionInput = screen.getByPlaceholderText(/Describe the purpose and use case/);
    expect(descriptionInput).toBeInTheDocument();
    expect(descriptionInput).toHaveValue('');
  });

  it('should show default policy checkbox', async () => {
    render(<CreateTransformationPolicy />);
    
    const defaultCheckbox = screen.getByRole('checkbox', { name: 'Set as default policy' });
    expect(defaultCheckbox).toBeInTheDocument();
    expect(defaultCheckbox).not.toBeChecked();
  });

  it('should require transformations or outputs to enable submit', async () => {
    const user = userEvent.setup();
    render(<CreateTransformationPolicy />);
    
    const nameInput = screen.getByPlaceholderText('e.g., Mobile Optimization Policy');
    const submitButton = screen.getByRole('button', { name: 'Create Policy' });
    
    // Fill policy name
    await user.type(nameInput, 'Test Policy');
    
    // Should still be disabled (needs transformations or outputs)
    expect(submitButton).toBeDisabled();
  });
});
