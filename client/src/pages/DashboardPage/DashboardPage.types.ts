import type { TableInfo } from '@/shared/types'

export type ViewMode = 'grid' | 'list'

export interface DashboardPageProps {
  onLogout?: () => void
  onTableSelect?: (tableId: string) => void
}

export interface DashboardStats {
  totalTables: number
  liveMatches: number
  activePlayers: number
  viewMode: ViewMode
}

export interface TableItem extends TableInfo {
  onClick?: (id: string) => void
}
