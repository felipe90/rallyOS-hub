import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from './ToastProvider';
import { ToastContainer } from './ToastContainer';
import { ToastContext } from './ToastProvider';

function TriggerAddToast({
  variant,
  message,
  duration,
}: {
  variant: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}) {
  const { addToast } = React.useContext(ToastContext);
  return <button onClick={() => addToast(variant, message, duration)}>Add</button>;
}

describe('ToastContainer', () => {
  beforeEach(() => {
    // Ensure portal target and root element exist
    if (!document.getElementById('toast-root')) {
      const portalRoot = document.createElement('div');
      portalRoot.id = 'toast-root';
      document.body.appendChild(portalRoot);
    }
    if (!document.getElementById('root')) {
      const rootEl = document.createElement('div');
      rootEl.id = 'root';
      document.body.appendChild(rootEl);
    }
  });

  afterEach(() => {
    document.getElementById('toast-root')?.remove();
    document.getElementById('root')?.remove();
  });

  it('renders toast content via portal into #toast-root', () => {
    render(
      <ToastProvider>
        <ToastContainer />
        <TriggerAddToast variant="success" message="Portal test" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Add').click();
    });

    const portalRoot = document.getElementById('toast-root')!;
    expect(portalRoot.textContent).toContain('Portal test');

    // The #root div should NOT contain the toast (it's portaled)
    const rootDiv = document.getElementById('root')!;
    expect(rootDiv.textContent).not.toContain('Portal test');
  });

  it('renders multiple toasts simultaneously', () => {
    render(
      <ToastProvider>
        <ToastContainer />
        <TriggerAddToast variant="success" message="First toast" />
        <TriggerAddToast variant="error" message="Second toast" />
      </ToastProvider>,
    );

    const buttons = screen.getAllByText('Add');
    act(() => {
      buttons.forEach(btn => btn.click());
    });

    const portalRoot = document.getElementById('toast-root')!;
    expect(portalRoot.textContent).toContain('First toast');
    expect(portalRoot.textContent).toContain('Second toast');
  });

  it('positions the container fixed at bottom center', () => {
    render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>,
    );

    const portalRoot = document.getElementById('toast-root')!;
    const container = portalRoot.querySelector('.fixed.bottom-6');
    expect(container).not.toBeNull();
  });

  it('returns null when #toast-root does not exist', () => {
    // Remove portal target
    const portalRoot = document.getElementById('toast-root');
    if (portalRoot) portalRoot.remove();

    const { container } = render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>,
    );

    // No portal created — container should not have rendered content
    expect(container.innerHTML).toBe('');
  });
});
