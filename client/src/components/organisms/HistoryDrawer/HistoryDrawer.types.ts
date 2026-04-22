import type { ScoreChange } from '@shared/types';

export interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScoreChange[];
  onUndo: (eventId: string) => void;
  className?: string;
}