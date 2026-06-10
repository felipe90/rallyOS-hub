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
import type { Sport } from '@shared/types'

export interface UseScoreboardEventsProps {
  emit: (event: string, data?: unknown) => void
  tableId: string
  canEdit: boolean
  connected: boolean
}

export interface MatchStartConfig {
  /** Sport identifier (defaults to tableTennis on server) */
  sport?: Sport
  /** Table tennis: points per set */
  pointsPerSet?: number
  /** Best of N sets */
  bestOf: number
  /** Table tennis: handicap for player A */
  handicapA?: number
  /** Table tennis: handicap for player B */
  handicapB?: number
  /** Padel: games per set */
  gamesPerSet?: number
  /** Padel: tiebreak target (7 or 10) */
  tiebreakPoints?: 7 | 10
  /** Padel: golden point / sudden death */
  goldenPoint?: boolean
  /** Player name A */
  playerNameA?: string
  /** Player name B */
  playerNameB?: string
}

export interface UseScoreboardEventsReturn {
  handleScorePoint: (player: 'A' | 'B') => void
  handleSubtractPoint: (player: 'A' | 'B') => void
  handleUndo: () => void
  handleSetServer: (player: 'A' | 'B') => void
  handleSwapSides: () => void
  handleStartMatch: (config: MatchStartConfig) => void
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
    emit(SocketEvents.CLIENT.RECORD_POINT, { player, courtId })
  }

  const handleSubtractPoint = (player: 'A' | 'B') => {
    if (!connected || !canEdit) return
    emit(SocketEvents.CLIENT.SUBTRACT_POINT, { player, courtId })
  }

  const handleUndo = () => {
    if (!connected || !canEdit) return
    emit(SocketEvents.CLIENT.UNDO_LAST, { courtId })
  }

  const handleSetServer = (player: 'A' | 'B') => {
    if (!connected || !canEdit) return
    const playerKey = player.toLowerCase() as 'a' | 'b'
    emit(SocketEvents.CLIENT.SET_SERVER, { player: playerKey, courtId })
  }

  const handleSwapSides = () => {
    if (!connected || !canEdit) return
    emit(SocketEvents.CLIENT.SWAP_SIDES, { courtId })
  }

  const handleStartMatch = (config: MatchStartConfig) => {
    if (!connected) return
    const payload: Record<string, unknown> = {
      tableId,
      bestOf: config.bestOf,
      playerNameA: config.playerNameA,
      playerNameB: config.playerNameB,
    }

    // Include sport if specified
    if (config.sport) {
      payload.sport = config.sport
    }

    // Include sport-specific fields (server ignores irrelevant ones)
    if (config.pointsPerSet !== undefined) payload.pointsPerSet = config.pointsPerSet
    if (config.handicapA !== undefined) payload.handicapA = config.handicapA
    if (config.handicapB !== undefined) payload.handicapB = config.handicapB
    if (config.gamesPerSet !== undefined) payload.gamesPerSet = config.gamesPerSet
    if (config.tiebreakPoints !== undefined) payload.tiebreakPoints = config.tiebreakPoints
    if (config.goldenPoint !== undefined) payload.goldenPoint = config.goldenPoint

    emit(SocketEvents.CLIENT.START_MATCH, payload)
  }

  const handleCancelMatch = () => {
    navigate(Routes.DASHBOARD_OWNER)
  }

  return {
    handleScorePoint,
    handleSubtractPoint,
    handleUndo,
    handleSetServer,
    handleSwapSides,
    handleStartMatch,
    handleCancelMatch,
  }
}
