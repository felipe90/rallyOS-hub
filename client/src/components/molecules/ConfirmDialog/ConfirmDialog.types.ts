export type ConfirmDialogSeverity = 'info' | 'warning' | 'success' | 'error';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  severity: ConfirmDialogSeverity;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}