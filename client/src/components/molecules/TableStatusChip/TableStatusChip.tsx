import type { TableStatus } from '../../../shared/types';
import { WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge } from '../../atoms/Badge';
import { Body } from '../../atoms/Typography';
import { RefreshCw } from 'lucide-react';

/* TableStatusChip Molecule - Table info card component */
export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: TableStatus;
  playerNames?: { a: string; b: string };
  playerCount?: number;
  className?: string;
  onClick?: () => void;
  pin?: string;        // PIN to display (only for Owner)
  qrCode?: string;   // QR code data URL (only for Owner)
  onClean?: () => void;  // Clean table (only for Owner)
}

const statusBadge: Record<TableStatus, typeof WaitingBadge> = {
  WAITING: WaitingBadge,
  CONFIGURING: ConfiguringBadge,
  LIVE: LiveBadge,
  FINISHED: FinishedBadge,
};

export function TableStatusChip({
  tableNumber,
  tableName,
  status,
  playerNames,
  playerCount = 0,
  className = '',
  onClick,
  pin,
  qrCode,
  onClean,
}: TableStatusChipProps) {
  const StatusBadgeComponent = statusBadge[status];
  
  return (
    <div
      onClick={onClick}
      className={`
        flex flex-col gap-2 p-4 rounded-[--radius-md]
        bg-surface shadow-sm hover:shadow-md
        transition-shadow duration-200
        cursor-pointer
        ${className}
      `}
    >
      <div className="flex items-center justify-between">
        <Body className="font-medium text-text-h">Mesa {tableNumber}</Body>
        <StatusBadgeComponent />
      </div>
      
      <Body className="text-sm text-text/70">{tableName}</Body>
      
      {playerNames && (playerNames.a || playerNames.b) && (
        <div className="flex gap-2 text-sm text-text/50">
          <span>{playerNames.a || '-'}</span>
          <span>vs</span>
          <span>{playerNames.b || '-'}</span>
        </div>
      )}

      {/* PIN and QR for Owner (RF-01, RF-02) */}
      {pin && (
        <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Body className="text-xs text-text/50">PIN:</Body>
            <Body className="text-sm font-mono font-bold text-primary">{pin}</Body>
          </div>
          {qrCode && (
            <img src={qrCode} alt="QR" className="w-12 h-12 ml-auto" />
          )}
        </div>
      )}

      {/* Clean button for Owner */}
      {onClean && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClean()
          }}
          className="mt-2 py-2 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Limpiar Mesa
        </button>
      )}
    </div>
  );
}