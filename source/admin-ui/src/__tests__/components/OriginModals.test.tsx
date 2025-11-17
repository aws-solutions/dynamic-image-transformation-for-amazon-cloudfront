import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../test-utils';
import { OriginModals } from '../../components/modals/OriginModals';
import { TEST_ORIGIN } from '../fixtures';

describe('OriginModals', () => {
  it('should render delete modal when visible', () => {
    render(
      <OriginModals
        showDeleteModal={true}
        onCloseDeleteModal={vi.fn()}
        onConfirmDelete={vi.fn()}
        deletingOrigin={TEST_ORIGIN}
      />
    );
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /delete origin server/i })).toBeInTheDocument();
    expect(screen.getByText(/Test Origin/)).toBeInTheDocument();
  });

  it('should not render modal when not visible', () => {
    const { container } = render(
      <OriginModals
        showDeleteModal={false}
        onCloseDeleteModal={vi.fn()}
        onConfirmDelete={vi.fn()}
        deletingOrigin={null}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should call onConfirmDelete when delete button is clicked', () => {
    const mockConfirm = vi.fn();
    
    render(
      <OriginModals
        showDeleteModal={true}
        onCloseDeleteModal={vi.fn()}
        onConfirmDelete={mockConfirm}
        deletingOrigin={TEST_ORIGIN}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCloseDeleteModal when cancel button is clicked', () => {
    const mockClose = vi.fn();
    
    render(
      <OriginModals
        showDeleteModal={true}
        onCloseDeleteModal={mockClose}
        onConfirmDelete={vi.fn()}
        deletingOrigin={TEST_ORIGIN}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
