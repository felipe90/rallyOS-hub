export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  addToast: (variant: ToastVariant, message: string, duration?: number) => void;
}

export const TOAST_DEFAULTS = {
  duration: 4000,
  maxVisible: 3,
} as const;
