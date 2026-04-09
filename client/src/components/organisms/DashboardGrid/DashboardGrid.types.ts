import type { TableInfo } from '../../../shared/types';

export interface DashboardGridProps {
  tables: TableInfo[];
  onTableClick?: (tableId: string) => void;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export interface DashboardHeaderProps {
  totalTables: number;
  liveMatches: number;
  activePlayers: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}