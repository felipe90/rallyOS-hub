import type { TableInfo, MatchStateExtended, AllHistoryEntry, KioskNotificationData } from '@shared/types'
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
  courts: TableInfo[]
  currentCourt: TableInfo | null
  currentMatch: MatchStateExtended | null
  allHistories: AllHistoryEntry[] | null
  hubConfig: HubConfigData | null
  kioskNotification: KioskNotificationData | null
  connect: () => void
  disconnect: () => void
  emit: (event: string, data?: unknown) => void
  createCourt: (name?: string) => void
  joinCourt: (tableId: string, pin: string, name?: string) => void
  requestCourts: () => void
  requestCourtsWithPins: (ownerPin?: string) => void
  scorePoint: (player: 'A' | 'B') => void
  undoLastPoint: () => void
  startMatch: (config?: { pointsPerSet: number; bestOf: number; playerNameA?: string; playerNameB?: string }) => void
  setReferee: (courtId: string, pin: string) => void
  regeneratePin: (courtId: string) => void
}

export interface SocketProviderProps {
  children: React.ReactNode
}