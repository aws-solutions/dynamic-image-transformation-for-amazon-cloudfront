import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import { OriginTable } from '../../components/tables/OriginTable';
import { OriginProvider } from '../../contexts/OriginContext';
import { MOCK_ORIGINS } from '../fixtures';

describe('OriginTable', () => {
  it('should render origins table with provider', () => {
    render(
      <OriginProvider>
        <OriginTable onDeleteClick={vi.fn()} />
      </OriginProvider>
    );
    
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    render(
      <OriginProvider>
        <OriginTable onDeleteClick={vi.fn()} />
      </OriginProvider>
    );
    
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
