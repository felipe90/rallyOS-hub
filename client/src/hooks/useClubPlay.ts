/**
 * useClubPlay — Club match play hook
 *
 * Handles socket events for the club player scoreboard.
 * Listens for MATCH_UPDATE and COURT_UPDATE, provides scorePoint and startMatch.
 *
 * Follows the same pattern as useScoreboardEvents but simplified for club mode.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { MatchStateExtended } from '@shared/types'

export function useClubPlay(socket: Socket | null, courtId: string, connected: boolean) {
  const [matchState, setMatchState] = useState<MatchStateExtended | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [refereeReplaced, setRefereeReplaced] = useState(false)
  const [sessionEnded, setSessionEnded] = useState<{ elapsedMinutes: number; cost: number; currency: string; reason: string } | null>(null)
  const reconnectAttempted = useRef(false)

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
        // Active match after page refresh → emit CLUB_RECONNECT to re-establish bridge.
        // Club-only hook — mode/clubStatus are not on MatchStateExtended.
        // SERVER validates OCCUPIED status before reconnecting.
        if (match.status !== 'FINISHED' && !reconnectAttempted.current) {
          reconnectAttempted.current = true
          setReconnecting(true)
          socket.emit(SocketEvents.CLIENT.CLUB_RECONNECT, { courtId })
        }
      }
    }

    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)

    return () => {
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    }
  }, [socket, courtId])

  // Listen for CLUB_RECONNECT_RESULT
  useEffect(() => {
    if (!socket) return

    const handleReconnectResult = (result: { success: boolean; courtId?: string; matchState?: MatchStateExtended; error?: string }) => {
      setReconnecting(false)
      if (result.success && result.matchState) {
        setMatchState(result.matchState)
        setError(null)
      } else if (!result.success) {
        setError(result.error || 'RECONNECT_FAILED')
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, handleReconnectResult)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, handleReconnectResult)
    }
  }, [socket])

  // Listen for REF_REVOKED
  useEffect(() => {
    if (!socket) return

    const handleRefRevoked = (data: { courtId: string }) => {
      if (data.courtId === courtId) {
        setRefereeReplaced(true)
      }
    }

    socket.on(SocketEvents.SERVER.REF_REVOKED, handleRefRevoked)

    return () => {
      socket.off(SocketEvents.SERVER.REF_REVOKED, handleRefRevoked)
    }
  }, [socket, courtId])

  // Listen for CLUB_SESSION_ENDED
  useEffect(() => {
    if (!socket) return

    const handleSessionEnded = (data: { courtId: string; elapsedMinutes: number; cost: number; currency: string; reason: string }) => {
      if (data.courtId === courtId) {
        setSessionEnded({
          elapsedMinutes: data.elapsedMinutes,
          cost: data.cost,
          currency: data.currency,
          reason: data.reason,
        })
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)
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

  // End session emit function
  const endSession = useCallback(
    () => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.CLUB_END_SESSION, { courtId })
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

  return { matchState, loading, error, finished, reconnecting, refereeReplaced, sessionEnded, scorePoint, subtractPoint, undoLast, swapSides, startMatch, endSession }
}
