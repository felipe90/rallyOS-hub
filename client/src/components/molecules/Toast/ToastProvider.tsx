import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { ToastItem, ToastVariant } from './Toast.types';
import { TOAST_DEFAULTS } from './Toast.types';

export interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (variant: ToastVariant, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (variant: ToastVariant, message: string, duration?: number) => {
      const id = crypto.randomUUID();
      const newToast: ToastItem = {
        id,
        variant,
        message,
        duration: duration ?? TOAST_DEFAULTS.duration,
      };

      setToasts(prev => {
        const next = [...prev, newToast];
        // FIFO eviction: cap at maxVisible
        if (next.length > TOAST_DEFAULTS.maxVisible) {
          return next.slice(next.length - TOAST_DEFAULTS.maxVisible);
        }
        return next;
      });
    },
    [],
  );

  // Auto-dismiss toasts after their duration
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const toast of toasts) {
      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
      timers.push(timer);
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [toasts, removeToast]);

  const contextValue = React.useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
}
