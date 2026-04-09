import type { TableInfo } from '@/shared/types'

export interface WaitingRoomPageProps {}

export interface WaitingRoomHandlers {
  onJoinTable: (tableId: string) => void
  onSelectTable: (tableId: string) => void
  onPinChange: (pin: string) => void
}

export type { TableInfo }
