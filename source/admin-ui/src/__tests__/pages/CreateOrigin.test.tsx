import { TEST_USER, TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect, vi } from 'vitest';
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

describe('CreateOrigin Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render create origin form', () => {
    render(<CreateOrigin />);
    
    expect(screen.getByRole('heading', { name: /create origin/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter the origin domain')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter origin name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create origin' })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<CreateOrigin />);
    
    const submitButton = screen.getByRole('button', { name: 'Create origin' });
    
    // Button should be disabled when required fields are empty
    expect(submitButton).toBeDisabled();
  });

  it('should validate domain format', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    
    const domainInput = screen.getByPlaceholderText('Enter the origin domain');
    await user.type(domainInput, 'invalid-domain-');
    
    const submitButton = screen.getByRole('button', { name: 'Create origin' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid domain format')).toBeInTheDocument();
    });
  });

  it('should add and removes custom headers', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    
    const addHeaderButton = screen.getByRole('button', { name: 'Add header' });
    await user.click(addHeaderButton);
    
    expect(screen.getByPlaceholderText('Enter header name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter header value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    
    const removeButton = screen.getByRole('button', { name: 'Remove' });
    await user.click(removeButton);
    
    expect(screen.queryByPlaceholderText('Enter header name')).not.toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    
    await user.type(screen.getByPlaceholderText('Enter origin name'), 'Test Origin');
    await user.type(screen.getByPlaceholderText('Enter the origin domain'), 'test.example.com');
    
    const submitButton = screen.getByRole('button', { name: 'Create origin' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/origins', {
        state: { 
          message: 'Successfully created origin "Test Origin"', 
          type: 'success', 
          timestamp: expect.any(Number) 
        }
      });
    });
  });
});