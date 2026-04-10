export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
  playerNames?: { a: string; b: string };
  playerCount?: number;
  className?: string;
  onClick?: () => void;
  pin?: string;        // PIN to display (only for Owner)
  qrCode?: string;   // QR code data URL (only for Owner)
  onClean?: () => void;  // Clean table - always for Owner (no PIN needed)
}