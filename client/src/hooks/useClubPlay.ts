/**
 * useClubPlay — Club match play hook
 *
 * Handles socket events for the club player scoreboard.
 * Listens for MATCH_UPDATE and COURT_UPDATE, provides scorePoint and startMatch.
 *
 * Follows the same pattern as useScoreboardEvents but simplified for club mode.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { MatchStateExtended } from '@shared/types'

export function useClubPlay(socket: Socket | null, courtId: string, connected: boolean) {
  const [matchState, setMatchState] = useState<MatchStateExtended | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  // Listen for MATCH_UPDATE events for this court
  useEffect(() => {
    if (!socket || !courtId) return

    const handleMatchUpdate = (match: MatchStateExtended) => {
      if (match.courtId === courtId) {
        setMatchState(match)
        setLoading(false)
        setError(null)
        if (match.status === 'FINISHED') {
          setFinished(true)
        }
      }
    }

    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)

    return () => {
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    }
  }, [socket, courtId])

  // Request initial match state on mount
  useEffect(() => {
    if (!socket || !connected || !courtId) return

    setLoading(true)
    socket.emit(SocketEvents.CLIENT.GET_MATCH_STATE, { courtId })
  }, [socket, connected, courtId])

  // Score point handler
  const scorePoint = useCallback(
    (player: 'A' | 'B') => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.RECORD_POINT, { player, courtId })
    },
    [socket, connected, courtId],
  )

  // Subtract point handler
  const subtractPoint = useCallback(
    (player: 'A' | 'B') => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.SUBTRACT_POINT, { player, courtId })
    },
    [socket, connected, courtId],
  )

  // Undo last action handler
  const undoLast = useCallback(
    () => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.UNDO_LAST, { courtId })
    },
    [socket, connected, courtId],
  )

  // Swap sides handler
  const swapSides = useCallback(
    () => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.SWAP_SIDES, { courtId })
    },
    [socket, connected, courtId],
  )

  // Start match with player names
  const startMatch = useCallback(
    (nameA: string, nameB: string) => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.START_MATCH, {
        courtId,
        playerNameA: nameA,
        playerNameB: nameB,
        bestOf: 1,
      })
    },
    [socket, connected, courtId],
  )

  return { matchState, loading, error, finished, scorePoint, subtractPoint, undoLast, swapSides, startMatch }
}
