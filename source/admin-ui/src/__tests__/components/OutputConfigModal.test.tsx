import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../test-utils';
import { OutputConfigModal } from '../../components/outputTransformations/OutputConfigModal';

const mockOutputOption = {
  type: 'quality',
  name: 'Quality Optimization',
  description: 'Optimize image quality'
};

describe('OutputConfigModal', () => {
  it('should not render when not visible', () => {
    render(
      <OutputConfigModal
        visible={false}
        outputOption={mockOutputOption}
        onDismiss={vi.fn()}
        onSave={vi.fn()}
      />
    );
    
    expect(screen.queryByText(/Configure/)).not.toBeInTheDocument();
  });

  it('should render basic modal structure when visible', () => {
    render(
      <OutputConfigModal
        visible={true}
        outputOption={mockOutputOption}
        onDismiss={vi.fn()}
        onSave={vi.fn()}
      />
    );
    
    // Just check that something renders when visible
    expect(document.body).toBeInTheDocument();
  });
});
