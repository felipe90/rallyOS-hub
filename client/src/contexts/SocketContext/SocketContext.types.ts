import type { TableInfo, MatchStateExtended, AllHistoryEntry } from '@shared/types'
import type { Socket } from 'socket.io-client'
import type { HubConfigData } from '../../hooks/useSocketState'

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
  errorCode: string | null
}

export interface SocketContextType {
  socket: Socket | null
  connected: boolean
  connecting: boolean
  error: string | null
  errorCode: string | null
  appError: string | null
  tables: TableInfo[]
  currentTable: TableInfo | null
  currentMatch: MatchStateExtended | null
  allHistories: AllHistoryEntry[] | null
  hubConfig: HubConfigData | null
  connect: () => void
  disconnect: () => void
  emit: (event: string, data?: unknown) => void
  createTable: (name?: string) => void
  joinTable: (tableId: string, pin: string, name?: string) => void
  requestTables: () => void
  requestTablesWithPins: (ownerPin?: string) => void
  scorePoint: (player: 'A' | 'B') => void
  undoLastPoint: () => void
  startMatch: (config?: { pointsPerSet: number; bestOf: number; playerNameA?: string; playerNameB?: string }) => void
  setReferee: (tableId: string, pin: string) => void
  regeneratePin: (tableId: string) => void
}

export interface SocketProviderProps {
  children: React.ReactNode
}