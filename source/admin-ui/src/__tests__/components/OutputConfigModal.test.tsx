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

    it('should show fallback format field when format is auto and hide when non-auto', async () => {
      // When format is 'auto' (default), fallback should be visible
      const { rerender } = render(
        <OutputConfigModal
          {...defaultProps}
          output={mockFormatOutputOption}
        />
      );
      expect(screen.getByText(/Fallback Format/)).toBeInTheDocument();

      // When editing with an explicit format, fallback should not be visible
      rerender(
        <OutputConfigModal
          {...defaultProps}
          output={mockFormatOutputOption}
          editingOutput={{ type: 'format', value: 'webp' }}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Fallback Format/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Fallback Configuration', () => {
    const mockAutosizeOutputOption = {
      id: 'autosize',
      title: 'Auto Sizing',
      description: 'Responsive image sizing'
    };

    it('should include fallback DPR in output when set', async () => {
      const mockOnAdd = vi.fn();
      render(<OutputConfigModal {...defaultProps} output={mockQualityOutputOption} onAdd={mockOnAdd} />);

      fireEvent.change(screen.getByLabelText(/Default Quality/), { target: { value: '80' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. 2.0'), { target: { value: '2.0' } });
      fireEvent.click(screen.getByText('Add to Policy'));

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          type: 'quality',
          value: [80],
          fallback: { dpr: 2.0 }
        });
      });
    });

    it('should omit fallback from output when not set', async () => {
      const mockOnAdd = vi.fn();
      render(<OutputConfigModal {...defaultProps} output={mockQualityOutputOption} onAdd={mockOnAdd} />);

      fireEvent.change(screen.getByLabelText(/Default Quality/), { target: { value: '80' } });
      fireEvent.click(screen.getByText('Add to Policy'));

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          type: 'quality',
          value: [80]
        });
      });
    });

    it('should include fallback viewportWidth in autosize output when set', async () => {
      const mockOnAdd = vi.fn();
      render(<OutputConfigModal {...defaultProps} output={mockAutosizeOutputOption} onAdd={mockOnAdd} />);

      fireEvent.change(screen.getByPlaceholderText('e.g. 1024'), { target: { value: '1024' } });
      fireEvent.click(screen.getByText('Add to Policy'));

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'autosize',
            fallback: { viewportWidth: 1024 }
          })
        );
      });
    });

    it('should clear fallback format when switching from auto to explicit format', async () => {
      const mockOnAdd = vi.fn();
      const { rerender } = render(
        <OutputConfigModal
          {...defaultProps}
          output={mockFormatOutputOption}
          editingOutput={{ type: 'format', value: 'auto', fallback: { format: 'webp' } }}
          onAdd={mockOnAdd}
        />
      );

      // Verify fallback is pre-populated when editing with 'auto'
      expect(screen.getByText(/Fallback Format/)).toBeInTheDocument();

      // Simulate switching to explicit format by re-rendering with non-auto value
      rerender(
        <OutputConfigModal
          {...defaultProps}
          output={mockFormatOutputOption}
          editingOutput={{ type: 'format', value: 'webp' }}
          onAdd={mockOnAdd}
        />
      );

      // Verify fallback field is removed
      await waitFor(() => {
        expect(screen.queryByText(/Fallback Format/)).not.toBeInTheDocument();
      });

      // Submit and verify fallback is not included
      fireEvent.click(screen.getByText('Add to Policy'));
      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.not.objectContaining({ fallback: expect.anything() })
        );
      });
    });

    it('should disable submit when fallback DPR is invalid', async () => {
      render(<OutputConfigModal {...defaultProps} output={mockQualityOutputOption} />);

      fireEvent.change(screen.getByLabelText(/Default Quality/), { target: { value: '80' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. 2.0'), { target: { value: '0.5' } });
      fireEvent.blur(screen.getByPlaceholderText('e.g. 2.0'));

      await waitFor(() => {
        const addButton = screen.getByText('Add to Policy');
        expect(addButton.closest('button')).toBeDisabled();
      });
    });

    it('should disable submit when fallback viewport width is invalid', async () => {
      render(<OutputConfigModal {...defaultProps} output={mockAutosizeOutputOption} />);

      fireEvent.change(screen.getByPlaceholderText('e.g. 1024'), { target: { value: '100' } });
      fireEvent.blur(screen.getByPlaceholderText('e.g. 1024'));

      await waitFor(() => {
        const addButton = screen.getByText('Add to Policy');
        expect(addButton.closest('button')).toBeDisabled();
      });
    });
  });
});
