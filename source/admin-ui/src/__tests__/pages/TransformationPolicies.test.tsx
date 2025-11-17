import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import TransformationPolicies from '../../pages/TransformationPolicies';

vi.mock('../../services/authService', () => ({
  AuthService: {
    signOut: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../contexts/TransformationPolicyContext', () => ({
  TransformationPolicyProvider: ({ children }: any) => children,
  useTransformationPolicyContext: () => ({
    allPolicies: [],
    deletePolicy: vi.fn()
  })
}));

describe('TransformationPolicies', () => {
  it('should render transformation policies page', () => {
    render(<TransformationPolicies />);
    
    expect(screen.getAllByText('Transformation Policies')[0]).toBeInTheDocument();
  });

  it('should render navigation and layout', () => {
    render(<TransformationPolicies />);
    
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should render breadcrumbs', () => {
    render(<TransformationPolicies />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
