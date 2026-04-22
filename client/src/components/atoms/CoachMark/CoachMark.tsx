import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hand } from 'lucide-react';

export interface CoachMarkProps {
  id: string;
  message: string;
  show: boolean;
  duration?: number;
  onDismiss?: () => void;
}

export function CoachMark({
  id,
  message,
  show,
  duration = 6000,
  onDismiss,
}: CoachMarkProps) {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `coachmark-dismissed-${id}`;

  useEffect(() => {
    if (!show) return;

    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setIsVisible(true);

      // Auto-hide after duration
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-[var(--color-scoreboard-bg-alt)]/90 backdrop-blur-md border border-white/10 shadow-xl">
            <Hand size={18} className="text-amber shrink-0" />
            <span className="text-sm text-white font-medium whitespace-nowrap">
              {message}
            </span>
            <button
              onClick={handleDismiss}
              className="ml-1 p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Entendido"
            >
              <X size={14} className="text-white/60" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
