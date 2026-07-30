import { useState, useEffect } from 'react';
import type { TournamentStatus, ClubStatus } from '@shared/types';
import { Badge } from '../../atoms/Badge';
import { Body } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import { ConfirmDialog } from '../ConfirmDialog';
import { RefreshCw, Trash2, Star } from 'lucide-react';
import { useI18n } from '@/i18n';

/* TableStatusChip Molecule - Court info card component */
export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: TournamentStatus | ClubStatus;
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
  /** Whether this court is currently featured (spotlight) */
  featured?: boolean;
  /** Callback to toggle featured status */
  onToggleFeatured?: () => void;
}

// Status pill colors synced with card border colors (statusBorderColor below)
const statusPillClass: Record<string, string> = {
  WAITING: 'bg-blue-500/15 text-blue-600',
  CONFIGURING: 'bg-amber-500/15 text-amber-600',
  LIVE: 'bg-emerald-500/15 text-emerald-600',
  FINISHED: 'bg-gray-500/15 text-gray-500',
};

const statusBadgeLabelKeys: Record<string, string> = {
  WAITING: 'courtStatusWaiting',
  CONFIGURING: 'courtStatusConfiguring',
  LIVE: 'courtStatusLive',
  FINISHED: 'courtStatusFinished',
};

function statusBorderColor(status: string): string {
  switch (status) {
    case 'WAITING':
    case 'AVAILABLE':
      return 'border-l-blue-500'
    case 'CONFIGURING':
    case 'RESERVED':
      return 'border-l-amber-500'
    case 'LIVE':
    case 'OCCUPIED':
      return 'border-l-emerald-500'
    case 'FINISHED':
      return 'border-l-gray-400'
    case 'MAINTENANCE':
      return 'border-l-red-500'
    default:
      return 'border-l-transparent'
  }
}

export function TableStatusChip({
  tableNumber,
  tableName,
  status,
  playerNames,
  currentSets,
  className = '',
  onClick,
  pin,
  onClean,
  showCleanConfirm = false,
  onCleanConfirm,
  onCleanCancel,
  onDelete,
  showDeleteConfirm = false,
  onDeleteConfirm,
  onDeleteCancel,
  statusLabel,
  featured,
  onToggleFeatured,
}: TableStatusChipProps) {
  const { i18nText } = useI18n();
  const pillClass = statusPillClass[status];
  const resolvedLabel = statusLabel || (statusBadgeLabelKeys[status] ? i18nText(statusBadgeLabelKeys[status]) : status);

  // Keep last known PIN to prevent flicker during updates
  const [lastKnownPin, setLastKnownPin] = useState(pin);

  useEffect(() => {
    if (pin) {
      setLastKnownPin(pin);
    }
  }, [pin]);

  const displayPin = pin || lastKnownPin;

  const hasPin = !!(pin || lastKnownPin);

  return (
    <div
      onClick={onClick}
      className={`
        card-light flex flex-col gap-2 p-4 border-l-4 ${statusBorderColor(status)}
        transition-shadow duration-200
        cursor-pointer
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <Body className="font-medium text-text-h truncate">{tableName}</Body>
        <div className="flex items-center gap-2 shrink-0">
          {hasPin && (
            <Badge className="bg-primary/10 text-primary font-bold tracking-wider font-mono">
              PIN {displayPin}
            </Badge>
          )}
          {pillClass ? (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${pillClass}`}>
              {resolvedLabel}
            </span>
          ) : (
            <Body className="text-xs text-muted-foreground">{resolvedLabel}</Body>
          )}
        </div>
      </div>
      
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

      {/* Clean button for Owner */}
      {onClean && (
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={16} />}
          onClick={() => onClean()}
          stopPropagation
        >
          Limpiar Cancha
        </Button>
      )}

      {/* Featured toggle button — only for LIVE/WAITING courts */}
      {onToggleFeatured && (status === 'LIVE' || status === 'WAITING') && (
        <Button
          variant={featured ? 'primary' : 'secondary'}
          size="sm"
          icon={<Star size={16} className={featured ? 'fill-amber-400 text-amber-400' : ''} />}
          onClick={() => onToggleFeatured()}
          stopPropagation
        >
          {featured ? i18nText('courtQuitarDestacado') : i18nText('courtDestacar')}
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
          aria-label={`Eliminar cancha ${tableName}`}
        >
          Eliminar Cancha
        </Button>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm && !!onDeleteConfirm && !!onDeleteCancel}
        title="Eliminar Cancha"
        message="¿Estás seguro de eliminar la cancha? Esta acción no se puede deshacer."
        severity="error"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => onDeleteConfirm?.()}
        onCancel={() => onDeleteCancel?.()}
      />

      {/* Clean confirmation - using ConfirmDialog component */}
      <ConfirmDialog
        isOpen={showCleanConfirm && !!onCleanConfirm && !!onCleanCancel}
        title="Limpiar Cancha"
        message="¿Estás seguro de resetear esta cancha? Se borrarán los nombres, el score y se generará un nuevo PIN."
        severity="warning"
        confirmLabel="Limpiar"
        cancelLabel="Cancelar"
        onConfirm={() => onCleanConfirm?.()}
        onCancel={() => onCleanCancel?.()}
      />

    </div>
  );
}