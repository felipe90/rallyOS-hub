import { motion } from 'framer-motion';
import type { TableInfo, TableInfoWithPin } from '../../../shared/types';
import { TableStatusChip } from '../../molecules/TableStatusChip';
import { StatCard } from '../../molecules/StatCard';
import { Body, Title } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import { LayoutGrid, List, RefreshCw } from 'lucide-react';

// Generate QR code URL (for Owner to share)
// The table link can be shared with referees to directly access the scoreboard
function generateTableUrl(tableId: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/scoreboard/${tableId}`;
}

export interface DashboardGridProps {
  tables: (TableInfo | TableInfoWithPin)[];
  onTableClick?: (tableId: string) => void;
  viewMode?: 'grid' | 'list';
  className?: string;
  showPin?: boolean;  // Show PIN for Owner
  showQr?: boolean;   // Show QR for Owner
  onCleanTable?: (tableId: string) => void;  // Clean/reset table (Owner only)
  cleanTableId?: string | null;  // Table ID being confirmed for cleaning
  onCleanTableConfirm?: () => void;  // Confirm clean
  onCleanTableCancel?: () => void;    // Cancel clean
  onDeleteTable?: (tableId: string) => void;  // Delete table (Owner only)
  showDeleteConfirm?: string | null;  // Table ID being confirmed for deletion
  onDeleteTableConfirm?: () => void;  // Confirm delete
  onDeleteTableCancel?: () => void;    // Cancel delete
}

export function DashboardGrid({ 
  tables, 
  onTableClick,
  viewMode = 'grid',
  className = '',
  showPin = false,
  showQr = false,
  onCleanTable,
  cleanTableId,
  onCleanTableConfirm,
  onCleanTableCancel,
  onDeleteTable,
  showDeleteConfirm,
  onDeleteTableConfirm,
  onDeleteTableCancel,
}: DashboardGridProps) {
  // Helper for QR code display
  const getQrDisplay = (tableId: string) => {
    if (!showQr) return undefined;
    return generateTableUrl(tableId);
  };

  if (viewMode === 'list') {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {tables.map((table) => (
          <motion.div
            key={table.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            <TableStatusChip
              tableNumber={table.number}
              tableName={table.name}
              status={table.status}
              playerNames={table.playerNames}
              playerCount={table.playerCount}
              currentSets={table.currentSets as { a: number; b: number } | undefined}
              className="cursor-pointer"
              onClick={() => onTableClick?.(table.id)}
              pin={showPin ? (table as TableInfoWithPin).pin : undefined}
              tableId={showPin ? table.id : undefined}
              onClean={onCleanTable ? () => onCleanTable(table.id) : undefined}
              showCleanConfirm={cleanTableId === table.id}
              onCleanConfirm={onCleanTableConfirm}
              onCleanCancel={onCleanTableCancel}
              onDelete={onDeleteTable ? () => onDeleteTable(table.id) : undefined}
              showDeleteConfirm={showDeleteConfirm === table.id}
              onDeleteConfirm={onDeleteTableConfirm}
              onDeleteCancel={onDeleteTableCancel}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {tables.map((table, index) => {
        // NO spanning - let each card be its own size
        // This prevents the overflow/alignment issues with spans
        
        return (
          <motion.div
            key={table.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="relative"
          >
            <TableStatusChip
              tableNumber={table.number}
              tableName={table.name}
              status={table.status}
              playerNames={table.playerNames}
              playerCount={table.playerCount}
              currentSets={table.currentSets as { a: number; b: number } | undefined}
              className="cursor-pointer"
              onClick={() => onTableClick?.(table.id)}
              pin={showPin ? (table as TableInfoWithPin).pin : undefined}
              tableId={showPin ? table.id : undefined}
              onClean={onCleanTable ? () => onCleanTable(table.id) : undefined}
              showCleanConfirm={cleanTableId === table.id}
              onCleanConfirm={onCleanTableConfirm}
              onCleanCancel={onCleanTableCancel}
              onDelete={onDeleteTable ? () => onDeleteTable(table.id) : undefined}
              showDeleteConfirm={showDeleteConfirm === table.id}
              onDeleteConfirm={onDeleteTableConfirm}
              onDeleteCancel={onDeleteTableCancel}
            />
          </motion.div>
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
}

export function DashboardHeader({ 
  totalTables, 
  liveMatches, 
  activePlayers,
  viewMode = 'grid',
  onViewModeChange = () => {},
}: Partial<DashboardHeaderProps> & { viewMode?: 'grid' | 'list'; onViewModeChange?: (mode: 'grid' | 'list') => void } = {}) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-end">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className={viewMode === 'grid' ? '!bg-white !text-slate-900' : '!text-slate-500'}
            aria-label="Grid view"
            icon={<LayoutGrid size={20} />}
          />
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className={viewMode === 'list' ? '!bg-white !text-slate-900' : '!text-slate-500'}
            aria-label="List view"
            icon={<List size={20} />}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Mesas" value={totalTables ?? 0} />
        <StatCard title="Partidos" value={liveMatches ?? 0} />
        <StatCard title="Jugadores" value={activePlayers ?? 0} />
      </div>
    </div>
  );
}