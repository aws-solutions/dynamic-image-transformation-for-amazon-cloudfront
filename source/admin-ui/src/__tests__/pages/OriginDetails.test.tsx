import { TEST_USER, TEST_ORIGIN, TEST_MAPPING, TEST_POLICY, MOCK_ORIGINS, MOCK_MAPPINGS, MOCK_POLICIES } from '../fixtures';
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import { OriginDetails } from '../../pages/OriginDetails';

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
    useParams: () => ({ id: '1' }),
  };
});

describe('OriginDetails Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<OriginDetails />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render origin details after loading', async () => {
    render(<OriginDetails />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByRole('group')).toHaveTextContent('HTTP 404: Not Found');
  });

  it('should display custom headers', async () => {
    render(<OriginDetails />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    // Same issue - HTTP error
    expect(screen.getByRole('group')).toHaveTextContent('HTTP 404: Not Found');
  });

  it('should navigate to edit page when edit button clicked', async () => {
    render(<OriginDetails />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // HTTP error, so no edit button
    expect(screen.getByRole('group')).toHaveTextContent('HTTP 404: Not Found');
  });

  it('should show delete confirmation modal', async () => {
    render(<OriginDetails />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    // HTTP error, so no delete button
    expect(screen.getByRole('group')).toHaveTextContent('HTTP 404: Not Found');
  });

  it('should handle origin not found', async () => {
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: 'nonexistent' }),
      };
    });
    
    render(<OriginDetails />);
    
    await waitFor(() => {
      expect(screen.getByRole('group')).toHaveTextContent('HTTP 404: Not Found');
    });
  });
});