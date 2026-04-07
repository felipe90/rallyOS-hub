import { motion } from 'framer-motion';
import type { TableInfo } from '../../../../shared/types';
import { TableStatusChip } from '../molecules/TableStatusChip';
import { Body, Title } from '../atoms/Typography';
import { LayoutGrid, List } from 'lucide-react';

/* DashboardGrid Organism - Asymmetric table grid */
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
            />
          </motion.div>
        );
      })}
    </div>
  );
}

/* DashboardHeader - Top bar with stats and view toggle */
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
  viewMode,
  onViewModeChange,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between">
        <Title>The Kinetic Clubhouse</Title>
        
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
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <Body className="text-slate-500 text-sm">Mesas</Body>
          <Title className="text-2xl">{totalTables}</Title>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <Body className="text-slate-500 text-sm">Partidos</Body>
          <Title className="text-2xl text-amber-600">{liveMatches}</Title>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <Body className="text-slate-500 text-sm">Jugadores</Body>
          <Title className="text-2xl text-teal-600">{activePlayers}</Title>
        </div>
      </div>
    </div>
  );
}