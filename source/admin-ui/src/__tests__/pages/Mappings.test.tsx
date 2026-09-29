import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Mappings from '../../pages/Mappings';
import { MappingProvider } from '../../contexts/MappingContext';
import { OriginProvider } from '../../contexts/OriginContext';
import { TransformationPolicyProvider } from '../../contexts/TransformationPolicyContext';
import { AppProvider } from '../../contexts/AppContext';

// Mock react-router hooks
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null })
  };
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AppProvider>
        <OriginProvider>
          <TransformationPolicyProvider>
            <MappingProvider>
              {component}
            </MappingProvider>
          </TransformationPolicyProvider>
        </OriginProvider>
      </AppProvider>
    </BrowserRouter>
  );
};

describe('Mappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render mappings page with navigation and create functionality', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Mappings />);
    
    // Test page structure and navigation elements
    expect(screen.getAllByText('Mappings')).toHaveLength(4); // breadcrumb (x2) + navigation (x2)
    
    // Test create button presence and functionality
    const createButton = screen.getByRole('button', { name: /create.*mapping/i });
    expect(createButton).toBeInTheDocument();
    
    // Test navigation on button click
    await user.click(createButton);
    expect(mockNavigate).toHaveBeenCalledWith('/mappings/create');
    
    // Additional UI structure assertions
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(2); // BreadcrumbGroup + SideNavigation
  });
});
