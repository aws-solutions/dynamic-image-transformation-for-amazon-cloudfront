import { TEST_USER, TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import CreateMapping from '../../pages/CreateMapping';

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

describe('CreateMapping Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable submit button when required fields are empty', async () => {
    render(<CreateMapping />);
    
    const submitButton = screen.getByRole('button', { name: 'Create mapping' });
    expect(submitButton).toBeDisabled();
  });

  it('should show correct form fields with placeholders', async () => {
    render(<CreateMapping />);
    
    const nameInput = screen.getByPlaceholderText('Enter mapping name');
    const descriptionInput = screen.getByPlaceholderText('Enter mapping description');
    const hostPatternInput = screen.getByPlaceholderText(/\*\.example\.com/);
    const pathPatternInput = screen.getByPlaceholderText(/\/api\/\*/);
    
    expect(nameInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
    expect(hostPatternInput).toBeInTheDocument();
    expect(pathPatternInput).toBeInTheDocument();
  });

  it.skip('should validate pattern mutual exclusion', async () => {
    const user = userEvent.setup();
    render(<CreateMapping />);
    
    const nameInput = screen.getByPlaceholderText('Enter mapping name');
    const hostPatternInput = screen.getByPlaceholderText(/\*\.example\.com/);
    const pathPatternInput = screen.getByPlaceholderText(/\/api\/\*/);
    
    await user.type(nameInput, 'Test Mapping');
    await user.type(hostPatternInput, '*.example.com');
    await user.type(pathPatternInput, '/api/*');
    
    await waitFor(() => {
      expect(screen.getByText(/Only one pattern is allowed/)).toBeInTheDocument();
    });
  });

  it('should allow either host pattern or path pattern', async () => {
    const user = userEvent.setup();
    render(<CreateMapping />);
    
    const hostPatternInput = screen.getByPlaceholderText(/\*\.example\.com/);
    
    await user.type(hostPatternInput, '*.example.com');
    
    // Should not show mutual exclusion error
    await waitFor(() => {
      expect(screen.queryByText(/Only one pattern is allowed/)).not.toBeInTheDocument();
    });
  });

  it('should show origin selection field', async () => {
    render(<CreateMapping />);
    
    const originSelect = screen.getByLabelText('Origin');
    expect(originSelect).toBeInTheDocument();
  });
});
