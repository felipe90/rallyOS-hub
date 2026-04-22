import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoldToConfirmButton } from './HoldToConfirmButton';

describe('HoldToConfirmButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders with default variant (danger)', () => {
    render(<HoldToConfirmButton onConfirm={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders with neutral variant', () => {
    render(<HoldToConfirmButton onConfirm={() => {}} variant="neutral" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onConfirm after holding for default duration', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm} holdDuration={500} />);
    
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button);
    
    // Fast-forward past hold duration
    vi.advanceTimersByTime(600);
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onConfirm if released early', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm} holdDuration={500} />);
    
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button);
    vi.advanceTimersByTime(200);
    fireEvent.pointerUp(button);
    
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels hold on pointer leave', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm} holdDuration={500} />);
    
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button);
    vi.advanceTimersByTime(200);
    fireEvent.pointerLeave(button);
    
    vi.advanceTimersByTime(600);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses custom aria-label', () => {
    render(<HoldToConfirmButton onConfirm={() => {}} ariaLabel="Custom label" />);
    expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
  });
});
