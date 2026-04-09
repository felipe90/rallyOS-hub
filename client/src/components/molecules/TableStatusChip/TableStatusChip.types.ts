export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
  playerNames?: { a: string; b: string };
  playerCount?: number;
  className?: string;
  onClick?: () => void;
}