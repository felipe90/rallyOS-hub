/**
 * useBracket — client-side bracket state + socket action emitter.
 *
 * Mirrors the focused-hook pattern of `useSocketState`: it accepts the socket
 * (the Owner page passes `socket` from `useSocketContext`). Listening to
 * server→client BRACKET_* events and emitting the owner-only client→server
 * events keeps all bracket I/O in one place.
 *
 * Why socket is a parameter (not pulled from context internally): testability
 * — `renderHook(() => useBracket(mockSocket))` needs no provider, and it
 * matches `useSocketState`. The integration page is responsible for sourcing
 * the socket from `useSocketContext()`.
 */

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { TournamentBracket, BracketSlot, Player } from '@shared/types'

export interface BracketError {
  code: string
  message: string
}

export type BracketNumSlots = 4 | 8 | 16 | 32

export interface UseBracketReturn {
  bracket: TournamentBracket | null
  error: BracketError | null
  /** Single-use token returned by the first BRACKET_RESET step. */
  resetToken: string | null
  resetExpiresIn: number | null
  createBracket: (name: string, numSlots: BracketNumSlots, includeThirdPlace?: boolean) => void
  assignPlayer: (matchId: string, slot: BracketSlot, name: string) => void
  setWinner: (matchId: string, winner: Player) => void
  assignCourt: (matchId: string, courtId: string | null) => void
  /** Owner-picker court binding (D13/TCS-1) — emits TOURNAMENT_SELECT_TABLE. */
  selectTable: (matchId: string, courtId: string) => void
  undoMatch: (matchId: string) => void
  getBracket: () => void
  /** Step 1 reset — server replies with BRACKET_RESET_CONFIRM (token). */
  reset: () => void
  /** Step 2 reset — clear using the previously issued token. */
  resetConfirm: (token: string) => void
  clearError: () => void
}

export function useBracket(socket: Socket | null): UseBracketReturn {
  const [bracket, setBracket] = useState<TournamentBracket | null>(null)
  const [error, setError] = useState<BracketError | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [resetExpiresIn, setResetExpiresIn] = useState<number | null>(null)

  useEffect(() => {
    if (!socket) return

    // Request the bracket snapshot on (re)mount: the server pushes
    // BRACKET_STATE once at connection time, but a page reload can attach
    // these listeners AFTER that one-shot emit. BRACKET_GET returns the
    // current state on demand — closes the reload race (same pattern as
    // LIST_COURTS / INVENTORY_LIST).
    socket.emit(SocketEvents.CLIENT.BRACKET_GET)

    const handleState = (next: TournamentBracket | null) => {
      setBracket(next)
      setError(null)
    }
    const handleError = (data: { code: string; message: string }) => {
      if (data && typeof data.code === 'string') {
        setError({ code: data.code, message: data.message })
      }
    }
    const handleResetConfirm = (data: { token: string; expiresIn: number }) => {
      if (data && typeof data.token === 'string') {
        setResetToken(data.token)
        setResetExpiresIn(typeof data.expiresIn === 'number' ? data.expiresIn : null)
        setError(null)
      }
    }

    socket.on(SocketEvents.SERVER.BRACKET_STATE, handleState)
    socket.on(SocketEvents.SERVER.BRACKET_ERROR, handleError)
    socket.on(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, handleResetConfirm)

    return () => {
      socket.off(SocketEvents.SERVER.BRACKET_STATE, handleState)
      socket.off(SocketEvents.SERVER.BRACKET_ERROR, handleError)
      socket.off(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, handleResetConfirm)
    }
  }, [socket])

  const emit = (event: string, payload?: unknown) => {
    if (!socket) return
    socket.emit(event, payload)
  }

  return {
    bracket,
    error,
    resetToken,
    resetExpiresIn,
    createBracket: (name, numSlots, includeThirdPlace = false) =>
      emit(SocketEvents.CLIENT.BRACKET_CREATE, { name, numSlots, includeThirdPlace }),
  assignPlayer: (matchId, slot, name) =>
    emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId, slot, name }),
    setWinner: (matchId, winner) =>
      emit(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId, winner }),
    assignCourt: (matchId, courtId) =>
      emit(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId, courtId }),
    /** Owner-picker court binding (D13/TCS-1) — emits TOURNAMENT_SELECT_TABLE. */
    selectTable: (matchId, courtId) =>
      emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId, courtId }),
    undoMatch: (matchId) =>
      emit(SocketEvents.CLIENT.BRACKET_UNDO_MATCH, { matchId }),
    getBracket: () => emit(SocketEvents.CLIENT.BRACKET_GET, undefined),
    reset: () => emit(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: undefined }),
    resetConfirm: (token) => emit(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: token }),
    clearError: () => setError(null),
  }
}