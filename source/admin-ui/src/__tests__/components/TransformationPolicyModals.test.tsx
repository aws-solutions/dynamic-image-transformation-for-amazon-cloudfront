import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../test-utils';
import { TransformationPolicyModals } from '../../components/modals/TransformationPolicyModals';
import { TEST_POLICY } from '../fixtures';

describe('TransformationPolicyModals', () => {
  const defaultProps = {
    showDeleteModal: false,
    onCloseDeleteModal: vi.fn(),
    onConfirmDelete: vi.fn(),
    deletingPolicy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render delete modal when visible', () => {
    render(
      <TransformationPolicyModals
        {...defaultProps}
        showDeleteModal={true}
        deletingPolicy={TEST_POLICY}
      />
    );
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Use getAllByText to handle multiple instances
    const deleteTexts = screen.getAllByText(/delete transformation policy/i);
    expect(deleteTexts.length).toBeGreaterThan(0);
    expect(screen.getByText(TEST_POLICY.policyName)).toBeInTheDocument();
  });

  it('should not render modal when not visible', () => {
    const { container } = render(<TransformationPolicyModals {...defaultProps} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should not render modal when no policy to delete', () => {
    const { container } = render(
      <TransformationPolicyModals {...defaultProps} showDeleteModal={true} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should call onCloseDeleteModal when cancel button is clicked', () => {
    const mockClose = vi.fn();
    
    render(
      <TransformationPolicyModals
        {...defaultProps}
        showDeleteModal={true}
        deletingPolicy={TEST_POLICY}
        onCloseDeleteModal={mockClose}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirmDelete when delete button is clicked', () => {
    const mockConfirm = vi.fn();
    
    render(
      <TransformationPolicyModals
        {...defaultProps}
        showDeleteModal={true}
        deletingPolicy={TEST_POLICY}
        onConfirmDelete={mockConfirm}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('should display warning message about deletion', () => {
    render(
      <TransformationPolicyModals
        {...defaultProps}
        showDeleteModal={true}
        deletingPolicy={TEST_POLICY}
      />
    );
    
    // The actual text is "You can't undo this action."
    expect(screen.getByText(/you can't undo this action/i)).toBeInTheDocument();
  });
});
