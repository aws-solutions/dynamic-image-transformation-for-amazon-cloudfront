import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import { TopNavigation } from '../../components/common/TopNavigation';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('TopNavigation', () => {
  it('should render navigation with app title and user menu', () => {
    render(<TopNavigation />);
    
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByText('Dynamic Image Transformation for Amazon CloudFront').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument();
  });
});
