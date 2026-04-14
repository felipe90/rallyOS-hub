export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
  playerNames?: { a: string; b: string };
  playerCount?: number;
  className?: string;
  onClick?: () => void;
  pin?: string;        // PIN to display (only for Owner)
  tableId?: string;   // Table ID for QR generation (only for Owner)
  onClean?: () => void;  // Clean table - always for Owner (no PIN needed)
  showCleanConfirm?: boolean;
  onCleanConfirm?: () => void;
  onCleanCancel?: () => void;
}