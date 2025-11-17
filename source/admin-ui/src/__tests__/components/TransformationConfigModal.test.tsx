import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import { TransformationConfigModal } from '../../components/transformationPolicy/TransformationConfigModal';
import { TransformationOption } from '../../types/interfaces';

const mockOnDismiss = vi.fn();
const mockOnBack = vi.fn();
const mockOnAdd = vi.fn();

describe('TransformationConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal and handle form submission', async () => {
    const user = userEvent.setup();
    const transformation: TransformationOption = {
      id: 'quality',
      title: 'Quality',
      description: 'Adjust image quality'
    };

    render(
      <TransformationConfigModal
        visible={true}
        onDismiss={mockOnDismiss}
        onBack={mockOnBack}
        onAdd={mockOnAdd}
        transformation={transformation}
      />
    );
    
    // Test modal structure
    expect(screen.getByText('Add Transformation - Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Policy' })).toBeInTheDocument();
    
    // Test form elements
    expect(screen.getByText('Quality Level')).toBeInTheDocument();
    const qualityInput = screen.getByRole('spinbutton');
    expect(qualityInput).toBeInTheDocument();
    
    // Test form interaction
    await user.type(qualityInput, '80');
    await user.click(screen.getByRole('button', { name: 'Add to Policy' }));
    
    expect(mockOnAdd).toHaveBeenCalled();
  });

  it('should handle form validation errors', async () => {
    const user = userEvent.setup();
    const transformation: TransformationOption = {
      id: 'quality',
      title: 'Quality',
      description: 'Adjust image quality'
    };

    render(
      <TransformationConfigModal
        visible={true}
        onDismiss={mockOnDismiss}
        onBack={mockOnBack}
        onAdd={mockOnAdd}
        transformation={transformation}
      />
    );
    
    const qualityInput = screen.getByRole('spinbutton');
    await user.type(qualityInput, '9999');
    await user.click(screen.getByRole('button', { name: 'Add to Policy' }));
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

});
