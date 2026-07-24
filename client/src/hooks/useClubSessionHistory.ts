/**
 * useClubSessionHistory — admin-side socket bridge for the session-history
 * feature.
 *
 * Responsibilities:
 *   1. Listen for `CLUB_SESSION_HISTORY` and unwrap the `{ sessions }`
 *      payload before storing it (server emits a wrapper object, NOT a
 *      bare array — see club-session-history apply-gotchas-pr2).
 *   2. Drive the two-step clear flow: `clearHistory()` initiates by
 *      emitting `CLUB_CLEAR_HISTORY`; `confirmClearHistory()` /
 *      `cancelClearHistory()` resolve the pending state.
 *   3. Mirror the server's 30s pending-clear window. If the admin does
 *      not confirm within 30s, the local pending state expires and a
 *      clearError is surfaced (the server discards its pending state
 *      in parallel — a late confirm would no-op).
 *
 * The hook is presentational glue — no business logic, no transforms.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { SessionRecord } from '@shared/types'

const PENDING_CLEAR_TIMEOUT_MS = 30_000

export interface UseClubSessionHistoryReturn {
  sessions: SessionRecord[]
  /** Initiate the clear flow — emits `CLUB_CLEAR_HISTORY`. */
  clearHistory: () => void
  /** Confirm the clear — emits `CLUB_CLEAR_HISTORY_CONFIRM` with confirm=true. */
  confirmClearHistory: () => void
  /** Cancel the clear flow without emitting a confirm. */
  cancelClearHistory: () => void
  /** True while waiting for the admin to confirm the clear (≤30s). */
  pendingClearConfirm: boolean
  /** Error surfaced from the clear flow (e.g. NO_CONNECTION, TIMEOUT). */
  clearError: string | null
  /** Decrypted phone from a successful CLUB_REVEAL_PHONE_RESULT. */
  revealedPhone: { sessionId: string; phone: string } | null
  /** Request server-side phone decryption — emits CLUB_REVEAL_PHONE with sessionId. */
  revealPhone: (sessionId: string) => void
  /** Clear the revealed phone state (dismiss the phone modal). */
  clearRevealedPhone: () => void
}

export function useClubSessionHistory(
  socket: Socket | null,
  _connected: boolean,
): UseClubSessionHistoryReturn {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [pendingClearConfirm, setPendingClearConfirm] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [revealedPhone, setRevealedPhone] = useState<{ sessionId: string; phone: string } | null>(null)

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Tracks the sessionId of the most recent CLUB_REVEAL_PHONE request
   *  so the CLUB_REVEAL_PHONE_RESULT handler can associate the decrypted
   *  phone with the correct session. */
  const pendingRevealRef = useRef<string | null>(null)

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
  }, [])

  /** Listen for `CLUB_SESSION_HISTORY` pushes and `CLUB_REVEAL_PHONE_RESULT`. */
  useEffect(() => {
    if (!socket) return

    const handleHistory = (data: { sessions: SessionRecord[] }) => {
      // Server payload is `{ sessions: SessionRecord[] }`. Forgetting this
      // unwrap → `undefined.map is not a function`.
      const records = data?.sessions ?? []
      setSessions(records)
    }

    const handleRevealResult = (data: { success: boolean; phone?: string }) => {
      const sid = pendingRevealRef.current
      if (!sid) return
      pendingRevealRef.current = null
      if (data?.success && data.phone) {
        setRevealedPhone({ sessionId: sid, phone: data.phone })
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_SESSION_HISTORY, handleHistory as (...args: unknown[]) => void)
    socket.on(SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT, handleRevealResult as (...args: unknown[]) => void)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_SESSION_HISTORY, handleHistory as (...args: unknown[]) => void)
      socket.off(SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT, handleRevealResult as (...args: unknown[]) => void)
    }
  }, [socket])

  /** Clean up any pending timer on unmount. */
  useEffect(() => {
    return () => {
      clearPendingTimer()
    }
  }, [clearPendingTimer])

  const clearHistory = useCallback(() => {
    if (!socket) {
      setClearError('NO_CONNECTION')
      return
    }
    setClearError(null)
    setPendingClearConfirm(true)
    socket.emit(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY, {})

    clearPendingTimer()
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null
      setPendingClearConfirm(false)
      setClearError('CLEAR_TIMEOUT')
    }, PENDING_CLEAR_TIMEOUT_MS)
  }, [socket, clearPendingTimer])

  const confirmClearHistory = useCallback(() => {
    if (!socket) {
      setClearError('NO_CONNECTION')
      setPendingClearConfirm(false)
      return
    }
    clearPendingTimer()
    setPendingClearConfirm(false)
    setClearError(null)
    socket.emit(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true })
  }, [socket, clearPendingTimer])

  const cancelClearHistory = useCallback(() => {
    clearPendingTimer()
    setPendingClearConfirm(false)
    setClearError(null)
  }, [clearPendingTimer])

  const revealPhone = useCallback(
    (sessionId: string) => {
      if (!socket) return
      pendingRevealRef.current = sessionId
      socket.emit(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, { sessionId })
    },
    [socket],
  )

  const clearRevealedPhone = useCallback(() => {
    setRevealedPhone(null)
  }, [])

  return {
    sessions,
    clearHistory,
    confirmClearHistory,
    cancelClearHistory,
    pendingClearConfirm,
    clearError,
    revealedPhone,
    revealPhone,
    clearRevealedPhone,
  }
}