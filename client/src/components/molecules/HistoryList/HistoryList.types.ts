export interface ScoreChange {
  action: 'POINT' | 'UNDO';
  player: string | undefined;
  timestamp: number;
}

export interface HistoryListProps {
  history: ScoreChange[];
  compact?: boolean;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}