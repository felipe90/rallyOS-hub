import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider, ToastContext } from './ToastProvider';
import { ToastContainer } from './ToastContainer';
import type { ToastContextValue, ToastItem } from './Toast.types';

/**
 * Consumer component that triggers addToast so we can verify
 * the toast is rendered via ToastContainer.
 */
function ToastTrigger({
  variant,
  message,
  duration,
}: {
  variant: ToastContextValue extends { addToast: (v: infer V, m: string, d?: number) => void } ? Parameters<ToastContextValue['addToast']>[0] : never;
  message: string;
  duration?: number;
}) {
  const { addToast } = React.useContext(ToastContext);
  return (
    <button onClick={() => addToast(variant as any, message, duration)}>
      Trigger
    </button>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure portal target exists
    if (!document.getElementById('toast-root')) {
      const portalRoot = document.createElement('div');
      portalRoot.id = 'toast-root';
      document.body.appendChild(portalRoot);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addToast adds a toast item and renders it via ToastContainer', () => {
    render(
      <ToastProvider>
        <ToastContainer />
        <ToastTrigger variant="success" message="Table created" />
      </ToastProvider>,
    );

    // Click the trigger to add a toast
    act(() => {
      screen.getByText('Trigger').click();
    });

    // The toast message should be rendered inside the toast-root portal
    const portalRoot = document.getElementById('toast-root')!;
    expect(portalRoot.textContent).toContain('Table created');
  });

  it('caps the toast queue at maxVisible (3) with FIFO eviction', () => {
    render(
      <ToastProvider>
        <ToastContainer />
        <ToastTrigger variant="info" message="Toast 1" />
        <ToastTrigger variant="info" message="Toast 2" />
        <ToastTrigger variant="info" message="Toast 3" />
        <ToastTrigger variant="info" message="Toast 4" />
      </ToastProvider>,
    );

    // There are 4 trigger buttons; click them all
    const buttons = screen.getAllByText('Trigger');
    act(() => {
      buttons.forEach(btn => btn.click());
    });

    const portalRoot = document.getElementById('toast-root')!;

    // Toast 1 should be evicted (FIFO), Toast 2,3,4 should be visible
    expect(portalRoot.textContent).not.toContain('Toast 1');
    expect(portalRoot.textContent).toContain('Toast 2');
    expect(portalRoot.textContent).toContain('Toast 3');
    expect(portalRoot.textContent).toContain('Toast 4');
  });

  it('auto-dismisses a toast after its configured duration', () => {
    render(
      <ToastProvider>
        <ToastContainer />
        <ToastTrigger variant="success" message="Auto-dismiss me" duration={1000} />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Trigger').click();
    });

    const portalRoot = document.getElementById('toast-root')!;
    expect(portalRoot.textContent).toContain('Auto-dismiss me');

    // Advance time past duration
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(portalRoot.textContent).not.toContain('Auto-dismiss me');
  });

  it('uses default duration of 4000ms when no duration is provided', () => {
    render(
      <ToastProvider>
        <ToastContainer />
        <ToastTrigger variant="warning" message="Default duration" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Trigger').click();
    });

    const portalRoot = document.getElementById('toast-root')!;
    expect(portalRoot.textContent).toContain('Default duration');

    // Advance 3500ms — still visible
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(portalRoot.textContent).toContain('Default duration');

    // Advance past 4000ms total
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(portalRoot.textContent).not.toContain('Default duration');
  });
});
