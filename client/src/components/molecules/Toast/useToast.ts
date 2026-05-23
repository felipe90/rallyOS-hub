import { useContext } from 'react';
import { ToastContext } from './ToastProvider';
import type { ToastContextValue } from './ToastProvider';

export const useToast = (): Pick<ToastContextValue, 'addToast'> => {
  const { addToast } = useContext(ToastContext);
  return { addToast };
};
