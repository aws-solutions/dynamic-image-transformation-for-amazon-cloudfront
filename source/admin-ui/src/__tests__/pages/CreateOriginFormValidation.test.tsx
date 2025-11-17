import { TEST_USER, TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import { CreateOrigin } from '../../pages/CreateOrigin';

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

describe('CreateOrigin Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable submit button when required fields are empty', async () => {
    render(<CreateOrigin />);
    
    const submitButton = screen.getByRole('button', { name: 'Create origin' });
    expect(submitButton).toBeDisabled();
  });

  it('should show correct form fields with placeholders', async () => {
    render(<CreateOrigin />);
    
    const nameInput = screen.getByPlaceholderText('Enter origin name');
    const domainInput = screen.getByPlaceholderText('Enter the origin domain');
    const pathInput = screen.getByPlaceholderText('Enter path to be appended to origin');
    
    expect(nameInput).toBeInTheDocument();
    expect(domainInput).toBeInTheDocument();
    expect(pathInput).toBeInTheDocument();
  });

  it('should enable submit button when all required fields are filled', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    
    const nameInput = screen.getByPlaceholderText('Enter origin name');
    const domainInput = screen.getByPlaceholderText('Enter the origin domain');
    const submitButton = screen.getByRole('button', { name: 'Create origin' });
    
    // Initially disabled
    expect(submitButton).toBeDisabled();
    
    // Fill required fields
    await user.type(nameInput, 'Test Origin');
    await user.type(domainInput, 'example.com');
    
    // Should be enabled now
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('should show custom header section', async () => {
    render(<CreateOrigin />);
    
    const headerSection = screen.getByText('Add custom header - optional');
    expect(headerSection).toBeInTheDocument();
  });
});
