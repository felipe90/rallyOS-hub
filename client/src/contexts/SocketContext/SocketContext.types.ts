import type { TableInfo, MatchStateExtended } from '@/shared/types'

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
}

export interface SocketContextType {
  socket: unknown
  connected: boolean
  connecting: boolean
  error: string | null
  tables: TableInfo[]
  currentTable: TableInfo | null
  currentMatch: MatchStateExtended | null
  connect: () => void
  disconnect: () => void
  emit: (event: string, data?: unknown) => void
  createTable: (name?: string) => void
  joinTable: (tableId: string, pin: string, role: string) => void
  requestTables: () => void
  scorePoint: (player: 'A' | 'B') => void
  undoLastPoint: () => void
  startMatch: (config: { pointsPerSet: number; bestOf: number }) => void
}

export interface SocketProviderProps {
  children: React.ReactNode
}