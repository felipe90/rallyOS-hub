import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from './Toast';
import type { ToastItem } from './Toast.types';

function makeToast(overrides?: Partial<ToastItem>): ToastItem {
  return {
    id: 'toast-1',
    variant: 'success',
    message: 'Test message',
    duration: 4000,
    ...overrides,
  };
}

describe('Toast', () => {
  it('renders the toast message', () => {
    render(<Toast toast={makeToast({ message: 'Table created' })} onDismiss={vi.fn()} />);
    expect(screen.getByText('Table created')).toBeInTheDocument();
  });

  it('renders success variant with green background', () => {
    render(<Toast toast={makeToast({ variant: 'success' })} onDismiss={vi.fn()} />);
    const container = screen.getByRole('alert');
    expect(container.className).toContain('bg-green-600');
    expect(container.className).toContain('text-white');
  });

  it('renders error variant with red background', () => {
    render(<Toast toast={makeToast({ variant: 'error' })} onDismiss={vi.fn()} />);
    const container = screen.getByRole('alert');
    expect(container.className).toContain('bg-red-600');
  });

  it('renders warning variant with amber background', () => {
    render(<Toast toast={makeToast({ variant: 'warning' })} onDismiss={vi.fn()} />);
    const container = screen.getByRole('alert');
    expect(container.className).toContain('bg-amber-500');
  });

  it('renders info variant with primary background', () => {
    render(<Toast toast={makeToast({ variant: 'info' })} onDismiss={vi.fn()} />);
    const container = screen.getByRole('alert');
    expect(container.className).toContain('bg-primary');
  });

  it('renders a close button with aria-label', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />);
    const closeButton = screen.getByRole('button', { name: /dismiss/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onDismiss with toast id when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ id: 'abc-123' })} onDismiss={onDismiss} />);

    const closeButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(closeButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('abc-123');
  });

  it('renders with role="alert" for accessibility', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
