import { useState, useEffect } from 'react';
import type { TableStatus } from '@shared/types';
import { WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge } from '../../atoms/Badge';
import { Body } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import { QRCodeImage } from '../QRCodeImage';
import { QrExpandModal } from '../QrExpandModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { RefreshCw, Trash2 } from 'lucide-react';
import { buildScoreboardUrl } from '@/services/url';
import { useI18n } from '@/i18n';

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
  onDelete?: () => void;           // Delete table (only for Owner)
  showDeleteConfirm?: boolean;        // Show delete confirmation
  onDeleteConfirm?: () => void;       // Confirm delete action
  onDeleteCancel?: () => void;        // Cancel delete action
  statusLabel?: string;
}

const statusBadge: Record<TableStatus, typeof WaitingBadge> = {
  WAITING: WaitingBadge,
  CONFIGURING: ConfiguringBadge,
  LIVE: LiveBadge,
  FINISHED: FinishedBadge,
};

const statusBadgeLabelKeys: Record<TableStatus, string> = {
  WAITING: 'tableStatusWaiting',
  CONFIGURING: 'tableStatusConfiguring',
  LIVE: 'tableStatusLive',
  FINISHED: 'tableStatusFinished',
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
  onDelete,
  showDeleteConfirm = false,
  onDeleteConfirm,
  onDeleteCancel,
  statusLabel,
}: TableStatusChipProps) {
  const { i18nText } = useI18n();
  const StatusBadgeComponent = statusBadge[status];
  const resolvedLabel = statusLabel || i18nText(statusBadgeLabelKeys[status]);

  // Keep last known PIN to prevent flicker during updates
  const [lastKnownPin, setLastKnownPin] = useState(pin);
  const [joinUrl, setJoinUrl] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (pin) {
      setLastKnownPin(pin);
    }
  }, [pin]);

  // Build QR URL async (AES-256-GCM encryption)
  const displayPin = pin || lastKnownPin;

  useEffect(() => {
    if (displayPin && tableId) {
      setJoinUrl(buildScoreboardUrl(tableId, displayPin))
    } else {
      setJoinUrl('')
    }
  }, [displayPin, tableId])

  const hasPin = !!(pin || lastKnownPin);

  const handleQrExpand = () => {
    setShowQrModal(true);
  };

  return (
    <div
      onClick={onClick}
      className={`
        card flex flex-col gap-2 p-4 rounded-[--radius-md]
        bg-surface shadow-sm hover:shadow-md
        transition-shadow duration-200
        cursor-pointer
        ${className}
      `}
    >
      <div className="flex items-center justify-between">
        <Body className="font-medium text-text-h">Mesa {tableNumber}</Body>
        <StatusBadgeComponent label={resolvedLabel} />
      </div>
      
      <Body className="text-sm text-text/70">{tableName}</Body>
      
      {playerNames && (playerNames.a || playerNames.b) && (
        <div className="flex gap-2 text-sm text-text-muted">
          <span>{playerNames.a || '-'}</span>
          <span>vs</span>
          <span>{playerNames.b || '-'}</span>
        </div>
      )}

      {/* Sets score for live matches */}
      {currentSets && (currentSets.a > 0 || currentSets.b > 0) && (
        <div className="flex items-center gap-2 mt-1">
          <Body className="text-xs text-text-muted">Sets:</Body>
          <div className="flex gap-1">
            <span className="text-sm font-bold text-text-h">{currentSets.a}</span>
            <span className="text-text-muted">-</span>
            <span className="text-sm font-bold text-text-h">{currentSets.b}</span>
          </div>
        </div>
      )}

      {/* PIN and QR for Owner (RF-01, RF-02) */}
      {hasPin && (
        <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Body className="text-xs text-text-muted">PIN:</Body>
            <Body className="text-sm font-mono font-bold text-primary">{displayPin}</Body>
          </div>
          {joinUrl && (
            <div
              className="ml-auto cursor-pointer"
              onClick={(e) => { e.stopPropagation(); handleQrExpand(); }}
            >
              <QRCodeImage joinUrl={joinUrl} size={48} />
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

      {/* Delete button for Owner */}
      {onDelete && (
        <Button
          variant="secondary"
          size="sm"
          icon={<Trash2 size={16} />}
          onClick={() => onDelete()}
          stopPropagation
          className="mt-2"
          aria-label={`Eliminar mesa ${tableName}`}
        >
          Eliminar Mesa
        </Button>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm && !!onDeleteConfirm && !!onDeleteCancel}
        title="Eliminar Mesa"
        message="¿Estás seguro de eliminar la mesa? Esta acción no se puede deshacer."
        severity="error"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => onDeleteConfirm?.()}
        onCancel={() => onDeleteCancel?.()}
      />

      {/* Clean confirmation - using ConfirmDialog component */}
      <ConfirmDialog
        isOpen={showCleanConfirm && !!onCleanConfirm && !!onCleanCancel}
        title="Limpiar Mesa"
        message="¿Estás seguro de resetear esta mesa? Se borrarán los nombres, el score y se generará un nuevo PIN."
        severity="warning"
        confirmLabel="Limpiar"
        cancelLabel="Cancelar"
        onConfirm={() => onCleanConfirm?.()}
        onCancel={() => onCleanCancel?.()}
      />

      {/* QR Fullscreen Modal */}
      <QrExpandModal
        joinUrl={showQrModal ? joinUrl : ''}
        onClose={() => setShowQrModal(false)}
      />

    </div>
  );
}