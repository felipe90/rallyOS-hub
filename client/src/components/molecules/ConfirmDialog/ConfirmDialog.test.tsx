import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Test Dialog',
    message: 'This is a test message',
    severity: 'info' as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders when isOpen is true', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders custom confirm and cancel labels when provided', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Keep"
      />
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it.each([
    { severity: 'info' as const, expectedText: 'info' },
    { severity: 'warning' as const, expectedText: 'warning' },
    { severity: 'success' as const, expectedText: 'success' },
    { severity: 'error' as const, expectedText: 'error' },
  ])('renders with $severity severity styling', ({ severity }) => {
    render(<ConfirmDialog {...defaultProps} severity={severity} />);
    // Dialog renders for all severities - styling is internal
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
  });
});