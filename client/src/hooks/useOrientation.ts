import { useState, useCallback } from 'react';

export function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orientation') === 'landscape';
    }
    return false;
  });

  const toggle = useCallback(() => {
    setIsLandscape(prev => {
      const next = !prev;
      localStorage.setItem('orientation', next ? 'landscape' : 'portrait');
      return next;
    });
  }, []);

  const setLandscape = useCallback((value: boolean) => {
    setIsLandscape(value);
    localStorage.setItem('orientation', value ? 'landscape' : 'portrait');
  }, []);

  return { isLandscape, toggle, setLandscape };
}