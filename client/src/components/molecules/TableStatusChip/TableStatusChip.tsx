import type { TableStatus } from '../../../shared/types';
import { WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge } from '../../atoms/Badge';
import { Body } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import { QRCodeImage } from '../QRCodeImage';
import { RefreshCw } from 'lucide-react';

/* TableStatusChip Molecule - Table info card component */
export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: TableStatus;
  playerNames?: { a: string; b: string };
  playerCount?: number;
  currentSets?: { a: number; b: number };  // Sets score for display
  className?: string;
  onClick?: () => void;
  pin?: string;        // PIN to display (only for Owner)
  tableId?: string;   // Table ID for QR generation (only for Owner)
  onClean?: () => void;  // Clean table (only for Owner)
  showCleanConfirm?: boolean;  // Show confirmation dialog
  onCleanConfirm?: () => void;  // Confirm clean action
  onCleanCancel?: () => void;   // Cancel clean action
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
  currentSets,
  className = '',
  onClick,
  pin,
  tableId,
  onClean,
  showCleanConfirm = false,
  onCleanConfirm,
  onCleanCancel,
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

      {/* Sets score for live matches */}
      {currentSets && (currentSets.a > 0 || currentSets.b > 0) && (
        <div className="flex items-center gap-2 mt-1">
          <Body className="text-xs text-text/50">Sets:</Body>
          <div className="flex gap-1">
            <span className="text-sm font-bold text-text-h">{currentSets.a}</span>
            <span className="text-text/30">-</span>
            <span className="text-sm font-bold text-text-h">{currentSets.b}</span>
          </div>
        </div>
      )}

      {/* PIN and QR for Owner (RF-01, RF-02) */}
      {pin && (
        <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Body className="text-xs text-text/50">PIN:</Body>
            <Body className="text-sm font-mono font-bold text-primary">{pin}</Body>
          </div>
          {pin && tableId && (
            <div className="ml-auto">
              <QRCodeImage tableId={tableId} pin={pin} size={48} />
            </div>
          )}
        </div>
      )}

      {/* Clean button for Owner */}
      {onClean && (
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={16} />}
          onClick={() => onClean()}
          stopPropagation
          className="mt-2"
        >
          Limpiar Mesa
        </Button>
      )}

      {/* Clean confirmation - rendered inline */}
      {showCleanConfirm && onCleanConfirm && onCleanCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={onCleanCancel} />
          <div className="relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm">
            <Body className="text-xl font-heading text-center mb-2">Limpiar Mesa</Body>
            <Body className="text-center text-text/70 mb-6">
              ¿Estás seguro de resetear esta mesa? Se borrarán los nombres, el score y se generará un nuevo PIN.
            </Body>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => onCleanCancel()} stopPropagation className="flex-1">
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => onCleanConfirm()} stopPropagation className="flex-1">
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}