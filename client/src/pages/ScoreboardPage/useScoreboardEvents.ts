/**
 * Scoreboard events hook
 * Contains all event handlers that interact with the socket.
 * Extracted from ScoreboardPage to reduce component complexity.
 *
 * All handlers check `canEdit` and `connected` before emitting.
 */

import { useNavigate } from 'react-router-dom'
import { SocketEvents } from '@shared/events'
import { Routes } from '@/routes'
// emit type: (event: string, data?: unknown) => void

export interface UseScoreboardEventsProps {
  emit: (event: string, data?: unknown) => void
  tableId: string
  canEdit: boolean
  connected: boolean
}

export interface UseScoreboardEventsReturn {
  handleScorePoint: (player: 'A' | 'B') => void
  handleSubtractPoint: (player: 'A' | 'B') => void
  handleUndo: () => void
  handleSetServer: (player: 'A' | 'B') => void
  handleStartMatch: (config: {
    pointsPerSet: number
    bestOf: number
    handicapA?: number
    handicapB?: number
    playerNameA?: string
    playerNameB?: string
  }) => void
  handleCancelMatch: () => void
}

export function useScoreboardEvents({
  emit,
  tableId,
  canEdit,
  connected,
}: UseScoreboardEventsProps): UseScoreboardEventsReturn {
  const navigate = useNavigate()

  const handleScorePoint = (player: 'A' | 'B') => {
    if (!connected || !canEdit) return
    emit(SocketEvents.CLIENT.RECORD_POINT, { player, tableId })
  }

  const handleSubtractPoint = (player: 'A' | 'B') => {
    if (!connected || !canEdit) return
    emit(SocketEvents.CLIENT.SUBTRACT_POINT, { player, tableId })
  }

  const handleUndo = () => {
    if (!connected || !canEdit) return
    emit(SocketEvents.CLIENT.UNDO_LAST, { tableId })
  }

  const handleSetServer = (player: 'A' | 'B') => {
    if (!connected || !canEdit) return
    const playerKey = player.toLowerCase() as 'a' | 'b'
    emit(SocketEvents.CLIENT.SET_SERVER, { player: playerKey, tableId })
  }

  const handleStartMatch = (config: {
    pointsPerSet: number
    bestOf: number
    handicapA?: number
    handicapB?: number
    playerNameA?: string
    playerNameB?: string
  }) => {
    if (!connected) return
    emit(SocketEvents.CLIENT.START_MATCH, {
      tableId,
      pointsPerSet: config.pointsPerSet,
      bestOf: config.bestOf,
      handicapA: config.handicapA,
      handicapB: config.handicapB,
      playerNameA: config.playerNameA,
      playerNameB: config.playerNameB,
    })
  }

  const handleCancelMatch = () => {
    navigate(Routes.DASHBOARD_OWNER)
  }

  return {
    handleScorePoint,
    handleSubtractPoint,
    handleUndo,
    handleSetServer,
    handleStartMatch,
    handleCancelMatch,
  }
}
