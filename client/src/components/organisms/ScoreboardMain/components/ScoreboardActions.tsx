import { motion } from 'framer-motion';
import { History, Settings } from 'lucide-react';

export interface ScoreboardActionsProps {
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  hasHistory: boolean;
  isLandscape?: boolean;
}

export function ScoreboardActions({ onHistoryClick, onSettingsClick, hasHistory, isLandscape }: ScoreboardActionsProps) {
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
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="History"
        >
          <History size={iconSize} />
        </motion.button>
      )}
      {onSettingsClick && (
        <motion.button
          className={btnClass}
          onClick={onSettingsClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Settings"
        >
          <Settings size={iconSize} />
        </motion.button>
      )}
    </div>
  );
}
