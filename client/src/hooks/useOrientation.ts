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
      // Sync fullscreen with landscape mode (hides address bar on Android)
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => {})
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
      return next;
    });
  }, []);

  const setLandscape = useCallback((value: boolean) => {
    setIsLandscape(value);
    preferencesStorage.setOrientation(value ? 'landscape' : 'portrait');
    // Sync fullscreen
    if (value) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, []);

  return { isLandscape, toggle, setLandscape };
}
