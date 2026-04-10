import { motion } from 'framer-motion';
import type { TableInfo } from '../../../shared/types';
import { TableStatusChip } from '../../molecules/TableStatusChip';
import { StatCard } from '../../molecules/StatCard';
import { Body, Title } from '../../atoms/Typography';
import { LayoutGrid, List } from 'lucide-react';

export interface DashboardGridProps {
  tables: TableInfo[];
  onTableClick?: (tableId: string) => void;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export function DashboardGrid({ 
  tables, 
  onTableClick,
  viewMode = 'grid',
  className = '',
}: DashboardGridProps) {
  if (viewMode === 'list') {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {tables.map((table) => (
          <motion.div
            key={table.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TableStatusChip
              tableNumber={table.number}
              tableName={table.name}
              status={table.status}
              playerNames={table.playerNames}
              playerCount={table.playerCount}
              className="cursor-pointer"
              onClick={() => onTableClick?.(table.id)}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {tables.map((table, index) => {
        const isWide = (index + 1) % 3 === 0;
        
        return (
          <motion.div
            key={table.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={isWide ? 'md:col-span-2' : ''}
          >
            <TableStatusChip
              tableNumber={table.number}
              tableName={table.name}
              status={table.status}
              playerNames={table.playerNames}
              playerCount={table.playerCount}
              className="cursor-pointer"
              onClick={() => onTableClick?.(table.id)}
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
      <div className="flex items-center justify-between">
        <Title>Dashboard</Title>
        
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`
              p-2 rounded-full transition-colors
              ${viewMode === 'grid' ? 'bg-white text-slate-900' : 'text-slate-500'}
            `}
            aria-label="Grid view"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`
              p-2 rounded-full transition-colors
              ${viewMode === 'list' ? 'bg-white text-slate-900' : 'text-slate-500'}
            `}
            aria-label="List view"
          >
            <List size={20} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Mesas" value={totalTables} />
        <StatCard title="Partidos" value={liveMatches} />
        <StatCard title="Jugadores" value={activePlayers} />
      </div>
    </div>
  );
}