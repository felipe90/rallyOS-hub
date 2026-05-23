import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { ToastContext } from './ToastProvider';
import { Toast } from './Toast';

export function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext);
  const shouldReduceMotion = useReducedMotion();

  const content = shouldReduceMotion ? (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  ) : (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );

  const portalRoot = document.getElementById('toast-root');
  if (!portalRoot) return null;

  return createPortal(content, portalRoot);
}
