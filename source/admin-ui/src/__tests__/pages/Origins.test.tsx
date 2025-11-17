import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../test-utils';
import { Origins } from '../../pages/Origins';
import { TEST_USER } from '../fixtures';

vi.mock('../../utils/user', () => ({
  getCurrentUser: () => ({ name: TEST_USER.name, email: TEST_USER.email }),
  handleSignOut: vi.fn(),
}));

describe('Origins Page', () => {
  it('should render origins page with navigation and content', async () => {
    render(<Origins />);
    
    expect(screen.getAllByText('Origins')).toHaveLength(2); // One in breadcrumb, one in navigation
    
    await waitFor(() => {
      expect(screen.getByText('Primary Image Server')).toBeInTheDocument();
    });
  });

  it('should display origins table with mock data', async () => {
    render(<Origins />);
    
    await waitFor(() => {
      expect(screen.getByText('Primary Image Server')).toBeInTheDocument();
      expect(screen.getByText('S3 Bucket Origin')).toBeInTheDocument();
      expect(screen.getByText('images.example.com')).toBeInTheDocument();
    });
  });
});