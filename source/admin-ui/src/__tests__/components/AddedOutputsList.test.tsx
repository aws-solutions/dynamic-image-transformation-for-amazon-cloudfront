import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import { AddedOutputsList } from '../../components/outputTransformations/AddedOutputsList';

const mockOutputs = [
  {
    type: 'quality',
    value: [75, [2, 999, 0.6]]
  }
];

describe('AddedOutputsList', () => {
  it('should render empty state', () => {
    render(
      <AddedOutputsList 
        outputs={[]} 
        onEdit={vi.fn()} 
        onRemove={vi.fn()} 
      />
    );
    
    expect(screen.getByText(/No output optimizations added yet/)).toBeInTheDocument();
  });

  it('should render outputs list', () => {
    render(
      <AddedOutputsList 
        outputs={mockOutputs} 
        onEdit={vi.fn()} 
        onRemove={vi.fn()} 
      />
    );
    
    expect(screen.getByText('Quality Optimization')).toBeInTheDocument();
  });
});
