/**
 * useClubPlay — Club match play hook
 *
 * Handles socket events for the club player scoreboard.
 * Listens for MATCH_UPDATE, COURT_UPDATE, CLUB_RECONNECT_RESULT,
 * CLUB_FREE_STARTED, CLUB_MATCH_RESET, CLUB_SESSION_TIMER,
 * CLUB_END_SESSION_CONFIRM, REF_REVOKED, CLUB_SESSION_ENDED.
 *
 * PR 3 — Club session lifecycle:
 *   - Tracks sessionMode ('free' | 'match' | null)
 *   - Tracks elapsedSeconds from server sync (CLUB_SESSION_TIMER +
 *     CLUB_END_SESSION_CONFIRM + CLUB_RECONNECT_RESULT)
 *   - Tracks pendingEndSessionConfirm for the end-session confirmation modal
 *   - Emits CLUB_START_FREE, CLUB_RESET_MATCH, CLUB_NEW_MATCH,
 *     CLUB_END_SESSION (with confirm payload)
 *
 * Follows the same pattern as useScoreboardEvents but simplified for club mode.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { MatchStateExtended, MatchConfig, SessionMode } from '@shared/types'

export function useClubPlay(socket: Socket | null, courtId: string, connected: boolean) {
  const [matchState, setMatchState] = useState<MatchStateExtended | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [refereeReplaced, setRefereeReplaced] = useState(false)
  const [sessionEnded, setSessionEnded] = useState<{ elapsedMinutes: number; cost: number; currency: string; reason: string } | null>(null)
  // PR 3 — club session lifecycle state
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [pendingEndSessionConfirm, setPendingEndSessionConfirm] = useState(false)
  // Read PIN from sessionStorage (set on CLUB_JOIN) for secure reconnection
  const courtPinRef = useRef<string | null>(sessionStorage.getItem('rallyos-club-pin'))
  // player-identity: read encryptionKey from sessionStorage (set in AuthPage from CLUB_JOIN_RESULT)
  const [encryptionKey, setEncryptionKey] = useState<string | null>(
    sessionStorage.getItem('rallyos-encryption-key') ?? null,
  )

  // PR 4 — tracks whether the player has yet chosen a session mode.
  // null = mode selection pending (ClubSessionConfig shown).
  // Cleared by the FIRST user action (startFreePlay, newMatch, startMatch)
  // or by CLUB_RECONNECT_RESULT on page refresh. After that, subsequent
  // MATCH_UPDATEs for LIVE may restore sessionMode via optimistic state.
  const initialModePending = useRef(true)

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
          // PR 3 — sessionMode is NEVER set from MATCH_UPDATE.
          // It's managed by:
          //   - CLUB_RECONNECT_RESULT (page refresh during play)
          //   - CLUB_FREE_STARTED (free mode)
          //   - optimistic set in newMatch/startMatch (match mode)
          //   - CLUB_SESSION_ENDED (session over)
        } else if (initialModePending.current) {
          // First MATCH_UPDATE after mount. Decide:
          //   LIVE → page refresh during active play → reconnect
          //   WAITING or other → fresh join → leave sessionMode null
          initialModePending.current = false
          if (match.status === 'LIVE') {
            setReconnecting(true)
            const pin = courtPinRef.current
            if (!pin) {
              setError('SESSION_EXPIRED')
              setReconnecting(false)
              return
            }
            socket.emit(SocketEvents.CLIENT.CLUB_RECONNECT, { courtId, pin })
          }
          // sessionMode stays null → ClubSessionConfig renders on fresh join
          // On page refresh, CLUB_RECONNECT_RESULT restores sessionMode
        }
        // Subsequent MATCH_UPDATEs — sessionMode already resolved.
        // Do NOT touch sessionMode here. newMatch/startMatch set it
        // optimistically. Score updates should not change it.
      }
    }

    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)

    return () => {
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    }
  }, [socket, courtId])

  // Listen for CLUB_RECONNECT_RESULT — consume sessionMode + elapsedSeconds
  // (spec scenarios 7, 8)
  useEffect(() => {
    if (!socket) return

    const handleReconnectResult = (result: {
      success: boolean
      courtId?: string
      matchState?: MatchStateExtended
      sessionMode?: SessionMode | null
      elapsedSeconds?: number
      error?: string
    }) => {
      setReconnecting(false)
      if (result.success) {
        if (result.matchState) {
          setMatchState(result.matchState)
        }
        // PR 3 — restore sessionMode (null allowed for legacy courts)
        if (result.sessionMode !== undefined) {
          setSessionMode(result.sessionMode ?? null)
        }
        // PR 3 — restore elapsed from server-authoritative timer
        if (typeof result.elapsedSeconds === 'number') {
          setElapsedSeconds(Math.max(0, Math.floor(result.elapsedSeconds)))
        }
        setError(null)
      } else {
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

  // Listen for CLUB_SESSION_ENDED — spec scenario 4. Reset lifecycle state.
  useEffect(() => {
    if (!socket) return

    const handleSessionEnded = (data: { courtId: string; elapsedMinutes: number; cost: number; currency: string; reason: string }) => {
      if (data.courtId === courtId) {
        // Clear PIN from sessionStorage when session ends
        sessionStorage.removeItem('rallyos-club-pin')
        courtPinRef.current = null
        setSessionEnded({
          elapsedMinutes: data.elapsedMinutes,
          cost: data.cost,
          currency: data.currency,
          reason: data.reason,
        })
        // PR 3 — session over; reset lifecycle state so PR 4 components exit
        // the in-session UI.
        setSessionMode(null)
        setElapsedSeconds(0)
        setPendingEndSessionConfirm(false)
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)
    }
  }, [socket, courtId])

  // PR 3 — CLUB_FREE_STARTED confirms the court switched to free mode.
  useEffect(() => {
    if (!socket || !courtId) return

    const handleFreeStarted = (data: { courtId: string }) => {
      if (data.courtId === courtId) {
        setSessionMode('free')
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_FREE_STARTED, handleFreeStarted)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_FREE_STARTED, handleFreeStarted)
    }
  }, [socket, courtId])

  // PR 3 — CLUB_MATCH_RESET delivers the fresh zeroed matchState from the
  // server. sessionMode stays 'match' (Reset action keeps the match context).
  useEffect(() => {
    if (!socket || !courtId) return

    const handleMatchReset = (data: { courtId: string; matchState: MatchStateExtended }) => {
      if (data.courtId === courtId && data.matchState) {
        setMatchState(data.matchState)
        setLoading(false)
        // Preserve sessionMode — Reset stays in match mode per spec.
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_MATCH_RESET, handleMatchReset)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_MATCH_RESET, handleMatchReset)
    }
  }, [socket, courtId])

  // PR 3 — CLUB_SESSION_TIMER is the periodic server-authoritative sync of
  // elapsedSeconds. Distinct from CLUB_END_SESSION_CONFIRM (which arms the
  // confirmation modal).
  useEffect(() => {
    if (!socket || !courtId) return

    const handleSessionTimer = (data: { courtId: string; elapsedSeconds: number }) => {
      if (data.courtId === courtId && typeof data.elapsedSeconds === 'number') {
        setElapsedSeconds(Math.max(0, Math.floor(data.elapsedSeconds)))
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_SESSION_TIMER, handleSessionTimer)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_SESSION_TIMER, handleSessionTimer)
    }
  }, [socket, courtId])

  // PR 3 — CLUB_END_SESSION_CONFIRM delivers the final elapsed for the
  // confirmation modal. Arms pendingEndSessionConfirm; the client (PR 4)
  // renders the modal and either emits CLUB_END_SESSION with confirm=true
  // or cancels locally.
  useEffect(() => {
    if (!socket || !courtId) return

    const handleEndSessionConfirm = (data: { courtId: string; elapsedSeconds: number }) => {
      if (data.courtId === courtId && typeof data.elapsedSeconds === 'number') {
        setElapsedSeconds(Math.max(0, Math.floor(data.elapsedSeconds)))
        setPendingEndSessionConfirm(true)
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, handleEndSessionConfirm)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, handleEndSessionConfirm)
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

  // PR 3 — End session emit function. confirm defaults to false (confirmation
  // request); pass true to confirm and transition the court to FINISHED.
  // Per spec, the client MUST NOT send elapsed values to the server, so the
  // payload only carries { courtId, confirm }.
  const endSession = useCallback(
    (confirm: boolean = false) => {
      if (!socket || !connected) return
      socket.emit(SocketEvents.CLIENT.CLUB_END_SESSION, { courtId, confirm })
      if (confirm) {
        // Optimistically clear the local confirmation state — the server will
        // broadcast CLUB_SESSION_ENDED which resets the rest. If the server
        // refuses (e.g., race), the next CLUB_END_SESSION_CONFIRM re-arms.
        setPendingEndSessionConfirm(false)
      }
    },
    [socket, connected, courtId],
  )

  // PR 3 — Cancel the end-session confirmation locally without emitting.
  // Per spec scenario 6, no server action is required on cancel; the court
  // stays OCCUPIED and the timer keeps running server-side.
  const cancelEndSession = useCallback(() => {
    setPendingEndSessionConfirm(false)
  }, [])

  // Start match with player names (initial match start path)
  const startMatch = useCallback(
    (nameA: string, nameB: string) => {
      if (!socket || !connected) return
      initialModePending.current = false
      setSessionMode('match')
      socket.emit(SocketEvents.CLIENT.START_MATCH, {
        courtId,
        playerNameA: nameA,
        playerNameB: nameB,
        bestOf: 1,
      })
    },
    [socket, connected, courtId],
  )

  // PR 3 — switch the OCCUPIED court to free mode. Server responds with
  // CLUB_FREE_STARTED, which flips sessionMode='free'.
  // player-identity: accepts optional playerName and phone (encrypted) for
  // the player submitting their info via ClubSessionConfig. Existing callers
  // (e.g. "Volver a libre" button) omit them for backward compatibility.
  const startFreePlay = useCallback(
    (name?: string, phone?: string) => {
      if (!socket || !connected) return
      initialModePending.current = false
      const payload: { courtId: string; playerName?: string; phone?: string } = { courtId }
      if (name !== undefined) payload.playerName = name
      if (phone !== undefined) payload.phone = phone
      socket.emit(SocketEvents.CLIENT.CLUB_START_FREE, payload)
    },
    [socket, connected, courtId],
  )

  // PR 3 — post-match "Reset" action. Server resets the match to 0-0 with
  // the SAME config and responds with CLUB_MATCH_RESET carrying the zeroed
  // matchState. sessionMode stays as-is (match stays match, free stays free).
  const resetMatch = useCallback(() => {
    if (!socket || !connected) return
    initialModePending.current = false
    socket.emit(SocketEvents.CLIENT.CLUB_RESET_MATCH, { courtId })
  }, [socket, connected, courtId])

  // PR 3 — post-match "New Match" action (also used for the free→match
  // transition). Optional matchConfig overrides the sport defaults so the
  // PR 4 match-config UI can request non-default points/sets/handicap.
  // Optimistically sets sessionMode='match' because the server WILL set
  // sessionMode=match on its side.
  // player-identity: accepts optional playerName and phone (encrypted) for
  // the player submitting their info via ClubSessionConfig. Existing callers
  // that already have a session omit them for backward compatibility.
  const newMatch = useCallback(
    (nameA: string, nameB: string, playerName?: string, phone?: string, matchConfig?: Partial<MatchConfig>) => {
      if (!socket || !connected) return
      initialModePending.current = false
      setSessionMode('match')
      const payload: {
        courtId: string
        playerNameA: string
        playerNameB: string
        playerName?: string
        phone?: string
        matchConfig?: Partial<MatchConfig>
      } = {
        courtId,
        playerNameA: nameA,
        playerNameB: nameB,
      }
      if (playerName !== undefined) payload.playerName = playerName
      if (phone !== undefined) payload.phone = phone
      if (matchConfig) {
        payload.matchConfig = matchConfig
      }
      socket.emit(SocketEvents.CLIENT.CLUB_NEW_MATCH, payload)
    },
    [socket, connected, courtId],
  )

  // PR 4 — local timer ticker. The server is expected to periodically emit
  // CLUB_SESSION_TIMER to resync, but that server-side mechanism was never
  // implemented (known gap). Until it is, this local 1s tick provides a
  // real-time display. Server events (CLUB_RECONNECT_RESULT,
  // CLUB_END_SESSION_CONFIRM, and eventually CLUB_SESSION_TIMER) correct
  // drift via setElapsedSeconds.
  useEffect(() => {
    if (sessionMode === null || sessionEnded || loading) return
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [sessionMode, sessionEnded, loading])

  return {
    matchState,
    loading,
    error,
    finished,
    reconnecting,
    refereeReplaced,
    sessionEnded,
    // PR 3 — club session lifecycle state
    sessionMode,
    elapsedSeconds,
    pendingEndSessionConfirm,
    // player-identity — encryption key for client-side phone encryption
    encryptionKey,
    // Emitters
    scorePoint,
    subtractPoint,
    undoLast,
    swapSides,
    startMatch,
    endSession,
    // PR 3 emitters
    startFreePlay,
    resetMatch,
    newMatch,
    cancelEndSession,
  }
}