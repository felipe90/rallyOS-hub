import { motion, useReducedMotion } from 'framer-motion';
import type { TableInfo, TableInfoWithPin } from '@shared/types';
import { CourtStatusChip } from '../../molecules/CourtStatusChip';
import { Body, Title } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import { LayoutGrid, List } from 'lucide-react';
import { useState, useRef, useCallback, type ReactNode } from 'react';

export interface DashboardGridProps {
  courts: (TableInfo | TableInfoWithPin)[];
  onCourtClick?: (courtId: string) => void;
  viewMode?: 'grid' | 'list';
  className?: string;
  showPin?: boolean;  // Show PIN for Owner
  showQr?: boolean;   // Show QR for Owner
  onCleanCourt?: (courtId: string) => void;  // Clean/reset court (Owner only)
  cleanConfirmCourtId?: string | null;  // Court ID being confirmed for cleaning
  onCleanCourtConfirm?: () => void;  // Confirm clean
  onCleanCourtCancel?: () => void;    // Cancel clean
  onDeleteCourt?: (courtId: string) => void;  // Delete court (Owner only)
  showDeleteConfirm?: string | null;  // Court ID being confirmed for deletion
  onDeleteCourtConfirm?: () => void;  // Confirm delete
  onDeleteCourtCancel?: () => void;    // Cancel delete
  /** Currently featured court ID for spotlight toggle display */
  featuredCourtId?: string | null;
  /** Called to toggle featured status for a court */
  onToggleFeatured?: (courtId: string) => void;
}

export function DashboardGrid({ 
  courts, 
  onCourtClick,
  viewMode = 'grid',
  className = '',
  showPin = false,
  onCleanCourt,
  cleanConfirmCourtId,
  onCleanCourtConfirm,
  onCleanCourtCancel,
  onDeleteCourt,
  showDeleteConfirm,
  onDeleteCourtConfirm,
  onDeleteCourtCancel,
  featuredCourtId,
  onToggleFeatured,
}: DashboardGridProps) {
  const shouldReduceMotion = useReducedMotion()

  if (viewMode === 'list') {
    const ListWrapper = shouldReduceMotion ? 'div' : motion.div
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {courts.map((court) => (
          <ListWrapper
            key={court.id}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.3 }}
            className="relative"
          >
            <CourtStatusChip
              tableNumber={court.number}
              tableName={court.name}
              status={court.status}
              playerNames={court.playerNames}
              playerCount={court.playerCount}
              currentSets={court.currentSets as { a: number; b: number } | undefined}
              className="cursor-pointer"
              onClick={() => onCourtClick?.(court.id)}
              pin={showPin ? (court as TableInfoWithPin).pin : undefined}
              tableId={showPin ? court.id : undefined}
              onClean={onCleanCourt ? () => onCleanCourt(court.id) : undefined}
              showCleanConfirm={cleanConfirmCourtId === court.id}
              onCleanConfirm={onCleanCourtConfirm}
              onCleanCancel={onCleanCourtCancel}
              onDelete={onDeleteCourt ? () => onDeleteCourt(court.id) : undefined}
              showDeleteConfirm={showDeleteConfirm === court.id}
              onDeleteConfirm={onDeleteCourtConfirm}
              onDeleteCancel={onDeleteCourtCancel}
              featured={court.featured === true}
              onToggleFeatured={onToggleFeatured ? () => onToggleFeatured(court.id) : undefined}
            />
          </ListWrapper>
        ))}
      </div>
    );
  }

  const GridWrapper = shouldReduceMotion ? 'div' : motion.div

  return (
    <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {courts.map((court, index) => {
        // NO spanning - let each card be its own size
        // This prevents the overflow/alignment issues with spans
        
        return (
          <GridWrapper
            key={court.id}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.3, delay: index * 0.1 }}
            className="relative"
          >
            <CourtStatusChip
              tableNumber={court.number}
              tableName={court.name}
              status={court.status}
              playerNames={court.playerNames}
              playerCount={court.playerCount}
              currentSets={court.currentSets as { a: number; b: number } | undefined}
              className="cursor-pointer"
              onClick={() => onCourtClick?.(court.id)}
              pin={showPin ? (court as TableInfoWithPin).pin : undefined}
              tableId={showPin ? court.id : undefined}
              onClean={onCleanCourt ? () => onCleanCourt(court.id) : undefined}
              showCleanConfirm={cleanConfirmCourtId === court.id}
              onCleanConfirm={onCleanCourtConfirm}
              onCleanCancel={onCleanCourtCancel}
              onDelete={onDeleteCourt ? () => onDeleteCourt(court.id) : undefined}
              showDeleteConfirm={showDeleteConfirm === court.id}
              onDeleteConfirm={onDeleteCourtConfirm}
              onDeleteCancel={onDeleteCourtCancel}
              featured={court.featured === true}
              onToggleFeatured={onToggleFeatured ? () => onToggleFeatured(court.id) : undefined}
            />
          </GridWrapper>
        );
      })}
    </div>
  );
}

export interface DashboardHeaderProps {
  totalTables: number;
  liveMatches: number;
  activePlayers: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  actions?: ReactNode;
  statIcons?: {
    canchas?: ReactNode;
    partidos?: ReactNode;
    jugadores?: ReactNode;
  };
  statLabels?: {
    tables?: string;
    matches?: string;
    players?: string;
  };
  gridViewLabel?: string;
  listViewLabel?: string;
}

export function DashboardHeader({ 
  totalTables, 
  liveMatches, 
  activePlayers,
  viewMode = 'grid',
  onViewModeChange = () => {},
  actions,
  statIcons,
  statLabels = {},
  gridViewLabel = '',
  listViewLabel = '',
}: Partial<DashboardHeaderProps> & { viewMode?: 'grid' | 'list'; onViewModeChange?: (mode: 'grid' | 'list') => void } = {}) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = useCallback((label: string) => {
    tooltipTimerRef.current = setTimeout(() => setTooltip(label), 300)
  }, [])

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
    setTooltip(null)
  }, [])
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          {actions}
        </div>

        <div className="relative flex-shrink-0">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-full">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              onMouseEnter={() => showTooltip(gridViewLabel)}
              onMouseLeave={hideTooltip}
              className={`${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'} transition-colors duration-200`}
              aria-label={gridViewLabel}
              icon={<LayoutGrid size={20} />}
            />
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              onMouseEnter={() => showTooltip(listViewLabel)}
              onMouseLeave={hideTooltip}
              className={`${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'} transition-colors duration-200`}
              aria-label={listViewLabel}
              icon={<List size={20} />}
            />
          </div>
          {tooltip && (
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              {tooltip}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface shadow-sm">
          {statIcons?.canchas}
          <Body className="text-text-muted text-xs">{statLabels.tables || ''}</Body>
          <Title className="text-text-h text-lg">{totalTables ?? 0}</Title>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface shadow-sm">
          {statIcons?.partidos}
          <Body className="text-text-muted text-xs">{statLabels.matches || ''}</Body>
          <Title className="text-text-h text-lg">{liveMatches ?? 0}</Title>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface shadow-sm">
          {statIcons?.jugadores}
          <Body className="text-text-muted text-xs">{statLabels.players || ''}</Body>
          <Title className="text-text-h text-lg">{activePlayers ?? 0}</Title>
        </div>
      </div>
    </div>
  );
}