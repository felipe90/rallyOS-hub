import { Body } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import type { ConfirmDialogSeverity, ConfirmDialogProps } from './ConfirmDialog.types';

const severityConfig: Record<ConfirmDialogSeverity, {
  icon: typeof Info;
  iconBg: string;
  iconColor: string;
  confirmVariant: 'primary' | 'danger' | 'success' | 'secondary';
}> = {
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmVariant: 'primary',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmVariant: 'secondary',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    confirmVariant: 'success',
  },
  error: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmVariant: 'danger',
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  severity,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const config = severityConfig[severity];
  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      
      {/* Dialog */}
      <div className="relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`${config.iconBg} ${config.iconColor} p-3 rounded-full`}>
            <IconComponent size={32} />
          </div>
        </div>

        {/* Title */}
        <Body className="text-xl font-heading text-center mb-2">{title}</Body>
        
        {/* Message */}
        <Body className="text-center text-text/70 mb-6">{message}</Body>
        
        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={() => onCancel?.()} 
            stopPropagation 
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button 
            variant={config.confirmVariant} 
            onClick={() => onConfirm()} 
            stopPropagation 
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}