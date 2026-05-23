import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastItem } from './Toast.types';

const VARIANT_STYLES: Record<ToastItem['variant'], string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-primary text-white',
};

const VARIANT_ICONS: Record<ToastItem['variant'], React.ComponentType<{ size?: number }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = VARIANT_ICONS[toast.variant];
  const variantStyle = VARIANT_STYLES[toast.variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-[420px] ${variantStyle}`}
      role="alert"
    >
      <Icon size={20} className="shrink-0" />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss toast"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
