import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../test-utils';
import { OutputConfigModal } from '../../components/outputTransformations/OutputConfigModal';

const mockQualityOutputOption = {
  id: 'quality',
  title: 'Quality Optimization',
  description: 'Optimize image quality based on device pixel ratio'
};

const mockFormatOutputOption = {
  id: 'format',
  title: 'Format Optimization',
  description: 'Optimize image format'
};

describe('OutputConfigModal', () => {
  const defaultProps = {
    visible: true,
    onDismiss: vi.fn(),
    onBack: vi.fn(),
    onAdd: vi.fn(),
    output: null,
    editingOutput: undefined
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when not visible', () => {
    render(
      <OutputConfigModal
        {...defaultProps}
        visible={false}
        output={mockQualityOutputOption}
      />
    );
    
    // Check that modal dialog has hidden class when visible=false
    const dialog = screen.queryByRole('dialog');
    expect(dialog?.className).toMatch(/awsui_hidden/);
  });

  it('should render basic modal structure when visible', () => {
    render(
      <OutputConfigModal
        {...defaultProps}
        output={mockQualityOutputOption}
      />
    );
    
    expect(screen.getByText(/Add Output - Step 2 of 2/)).toBeInTheDocument();
    expect(screen.getByText('Quality Optimization')).toBeInTheDocument();
  });

  describe('Quality Integer Fix Tests', () => {
    it('should generate quality config with integer values for DPR rules', async () => {
      const mockOnAdd = vi.fn();
      render(<OutputConfigModal {...defaultProps} output={mockQualityOutputOption} onAdd={mockOnAdd} />);

      fireEvent.change(screen.getByLabelText(/Default Quality/), { target: { value: '80' } });
      
      fireEvent.click(screen.getByText('Add DPR Rule'));
      fireEvent.change(screen.getAllByLabelText(/DPR Range/)[0], { target: { value: '1-1.5' } });
      fireEvent.change(screen.getAllByLabelText(/Quality/)[1], { target: { value: '60' } });

      fireEvent.click(screen.getByText('Add DPR Rule'));
      fireEvent.change(screen.getAllByLabelText(/DPR Range/)[1], { target: { value: '2+' } });
      fireEvent.change(screen.getAllByLabelText(/Quality/)[2], { target: { value: '90' } });

      fireEvent.click(screen.getByText('Add to Policy'));

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          type: 'quality',
          value: [80, [1, 1.5, 60], [2, 999, 90]]
        });
      });
    });

    it('should validate quality values are within 1-100 range', async () => {
      render(<OutputConfigModal {...defaultProps} output={mockQualityOutputOption} />);

      fireEvent.click(screen.getByText('Add DPR Rule'));
      const qualityInput = screen.getAllByLabelText(/Quality/)[1];
      fireEvent.change(qualityInput, { target: { value: '150' } });
      fireEvent.blur(qualityInput);

      await waitFor(() => {
        expect(screen.getByText(/Quality must be between 1 and 100/)).toBeInTheDocument();
      });
    });
  });

  describe('Other Output Types', () => {
    it('should handle format output configuration', () => {
      render(
        <OutputConfigModal
          {...defaultProps}
          output={mockFormatOutputOption}
        />
      );

      expect(screen.getByText('Format Optimization')).toBeInTheDocument();
      expect(screen.getByText(/Format Selection/)).toBeInTheDocument();
    });
  });
});
