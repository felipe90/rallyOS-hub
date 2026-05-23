import { motion, useReducedMotion } from 'framer-motion';
import { History, Settings } from 'lucide-react';
import { useI18n } from '@/i18n';

export interface ScoreboardActionsProps {
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  hasHistory: boolean;
  isLandscape?: boolean;
}

export function ScoreboardActions({ onHistoryClick, onSettingsClick, hasHistory, isLandscape }: ScoreboardActionsProps) {
  const { i18nText } = useI18n()
  const shouldReduceMotion = useReducedMotion()
  const btnClass = isLandscape 
    ? "p-2 rounded-[--radius-md] bg-surface hover:bg-surface-high transition-colors"
    : "p-1 rounded-[--radius-md] bg-surface-high hover:bg-surface transition-colors";
  
  const iconSize = isLandscape ? 18 : 16;

  return (
    <div className="flex gap-2">
      {hasHistory && onHistoryClick && (
        <motion.button
          className={btnClass}
          onClick={onHistoryClick}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
          aria-label={i18nText('scoreboardHistory')}
        >
          <History size={iconSize} />
        </motion.button>
      )}
      {onSettingsClick && (
        <motion.button
          className={btnClass}
          onClick={onSettingsClick}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
          aria-label={i18nText('scoreboardSettings')}
        >
          <Settings size={iconSize} />
        </motion.button>
      )}
    </div>
  );
}
