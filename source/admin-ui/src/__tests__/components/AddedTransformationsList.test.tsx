import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import { AddedTransformationsList } from '../../components/transformationPolicy/AddedTransformationsList';

const mockTransformations = [
  {
    transformation: 'quality',
    value: 80,
    condition: null
  }
];

describe('AddedTransformationsList', () => {
  it('should render empty state', () => {
    render(
      <AddedTransformationsList 
        transformations={[]} 
        onEdit={vi.fn()} 
        onRemove={vi.fn()} 
      />
    );
    
    expect(screen.getByText(/No transformations added yet/)).toBeInTheDocument();
  });

  it('should render transformations list', () => {
    render(
      <AddedTransformationsList 
        transformations={mockTransformations} 
        onEdit={vi.fn()} 
        onRemove={vi.fn()} 
      />
    );
    
    expect(screen.getByText('Quality')).toBeInTheDocument();
  });
});
