export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
  tablePin?: string;
  playerNames?: { a: string; b: string };
  playerCount?: number;
  className?: string;
  onClick?: () => void;
}