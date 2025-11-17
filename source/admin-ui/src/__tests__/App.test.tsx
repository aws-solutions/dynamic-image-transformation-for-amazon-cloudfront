import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
  signOut: vi.fn(),
  signInWithRedirect: vi.fn(),
  fetchUserAttributes: vi.fn(),
}));

describe('App', () => {
  it('should render disclaimer message', () => {
    render(<App />);
    
    expect(screen.getByText(/© 2025, Amazon Web Services, Inc. or its affiliates./)).toBeInTheDocument();
    expect(screen.getByText('Disclaimer:')).toBeInTheDocument();
    expect(screen.getByText(/Use of Dynamic Image Transformation is subject to the Terms of Use/)).toBeInTheDocument();
  });
});
