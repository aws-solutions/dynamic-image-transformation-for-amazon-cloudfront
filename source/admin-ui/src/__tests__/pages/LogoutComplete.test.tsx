import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import LogoutComplete from '../../pages/LogoutComplete';

const mockSignInWithRedirect = vi.fn();

vi.mock('aws-amplify/auth', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    signInWithRedirect: mockSignInWithRedirect
  };
});

describe('LogoutComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithRedirect.mockReset();
    Object.defineProperty(window, 'history', {
      value: { replaceState: vi.fn() },
      writable: true,
    });
  });

  it('should render logout complete message', () => {
    render(<LogoutComplete />);
    
    expect(screen.getByText('Signed Out')).toBeInTheDocument();
    expect(screen.getByText(/You have been successfully signed out/)).toBeInTheDocument();
  });

  it('should render sign in button', () => {
    render(<LogoutComplete />);
    
    expect(screen.getByRole('button', { name: /sign in again/i })).toBeInTheDocument();
  });

  it('should replace history state on mount', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    
    render(<LogoutComplete />);
    
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/auth/logout-complete");
  });



  it('should handle sign in error gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignInWithRedirect.mockRejectedValue(new Error('Sign in failed'));
    
    render(<LogoutComplete />);
    
    const signInButton = screen.getByRole('button', { name: /sign in again/i });
    await user.click(signInButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Sign in error:', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
  });
});
