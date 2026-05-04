import { useState, useCallback } from 'react';
import { preferencesStorage } from '@/services/storage';

export function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window !== 'undefined') {
      return preferencesStorage.getOrientation() === 'landscape';
    }
    return false;
  });

  const toggle = useCallback(() => {
    setIsLandscape(prev => {
      const next = !prev;
      preferencesStorage.setOrientation(next ? 'landscape' : 'portrait');
      return next;
    });
  }, []);

  const setLandscape = useCallback((value: boolean) => {
    setIsLandscape(value);
    preferencesStorage.setOrientation(value ? 'landscape' : 'portrait');
  }, []);

  return { isLandscape, toggle, setLandscape };
}
