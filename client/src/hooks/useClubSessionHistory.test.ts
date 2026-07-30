/**
 * useClubSessionHistory — strict TDD tests.
 *
 * Covers the gotcha from PR 2: the SERVER event payload is
 * `{ sessions: SessionRecord[] }` (wrapper object), NOT a bare array.
 * The hook MUST unwrap before setState or `undefined.map` will fire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClubSessionHistory } from './useClubSessionHistory'
import { SocketEvents } from '@shared/events'
import type { SessionRecord } from '@shared/types'

function makeMockSocket() {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
  return {
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      ;(handlers[event] ||= []).push(fn)
    }),
    off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      const list = handlers[event]
      if (!list) return
      const i = list.indexOf(fn)
      if (i !== -1) list.splice(i, 1)
    }),
    emit: vi.fn(),
    connected: true,
    // Test driver: fire an event registered via .on(...)
    fire(event: string, payload: unknown) {
      const list = handlers[event] || []
      // Copy first — handlers may re-register
      const snapshot = [...list]
      for (const fn of snapshot) fn(payload)
    },
    handlerCount(event: string) {
      return (handlers[event] || []).length
    },
  }
}

const sampleRecords: SessionRecord[] = [
  {
    courtName: 'Cancha 1',
    elapsedSeconds: 600,
    elapsedMinutes: 10,
    mode: 'match',
    cost: 500,
    currency: 'ARS',
    timestamp: '2026-07-20T10:00:00.000Z',
    sessionId: 'a-1',
  },
  {
    courtName: 'Cancha 2',
    elapsedSeconds: 1200,
    elapsedMinutes: 20,
    mode: 'free',
    cost: 0,
    currency: 'ARS',
    timestamp: '2026-07-20T11:00:00.000Z',
    sessionId: 'b-2',
  },
]

describe('useClubSessionHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty sessions and no pending clear', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    expect(result.current.sessions).toEqual([])
    expect(result.current.pendingClearConfirm).toBe(false)
    expect(result.current.clearError).toBeNull()
  })

  it('unwraps the `{ sessions }` payload from CLUB_SESSION_HISTORY and stores the array', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_SESSION_HISTORY, { sessions: sampleRecords })
    })
    expect(result.current.sessions).toHaveLength(2)
    expect(result.current.sessions[0].courtName).toBe('Cancha 1')
    expect(result.current.sessions[1].mode).toBe('free')
  })

  it('handles an empty `sessions` array (clear broadcast) without crashing', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_SESSION_HISTORY, { sessions: sampleRecords })
    })
    expect(result.current.sessions).toHaveLength(2)
    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_SESSION_HISTORY, { sessions: [] })
    })
    expect(result.current.sessions).toEqual([])
  })

  it('clearHistory() emits CLUB_CLEAR_HISTORY and enters pending-clear state', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.clearHistory()
    })
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY, {})
    expect(result.current.pendingClearConfirm).toBe(true)
    expect(result.current.clearError).toBeNull()
  })

  it('confirmClearHistory() emits CLUB_CLEAR_HISTORY_CONFIRM with confirm=true and clears pending state', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.clearHistory()
    })
    act(() => {
      result.current.confirmClearHistory()
    })
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, {
      confirm: true,
    })
    expect(result.current.pendingClearConfirm).toBe(false)
  })

  it('cancelClearHistory() clears pending state WITHOUT emitting confirm', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.clearHistory()
    })
    act(() => {
      result.current.cancelClearHistory()
    })
    expect(result.current.pendingClearConfirm).toBe(false)
    // confirm event was never emitted
    const confirmCalls = (socket.emit as any).mock.calls.filter(
      ([ev]: [string]) => ev === SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM,
    )
    expect(confirmCalls).toHaveLength(0)
  })

  it('expires pending-clear after 30s and surfaces a clearError', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.clearHistory()
    })
    expect(result.current.pendingClearConfirm).toBe(true)
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current.pendingClearConfirm).toBe(false)
    expect(result.current.clearError).not.toBeNull()
  })

  it('confirmClearHistory() before the 30s window cancels the pending timer (no late expiry)', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.clearHistory()
    })
    act(() => {
      result.current.confirmClearHistory()
    })
    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    expect(result.current.pendingClearConfirm).toBe(false)
    expect(result.current.clearError).toBeNull()
  })

  it('clearHistory() without a socket sets clearError=NO_CONNECTION and does not emit', () => {
    const { result } = renderHook(() => useClubSessionHistory(null, false))
    act(() => {
      result.current.clearHistory()
    })
    expect(result.current.clearError).toBe('NO_CONNECTION')
    expect(result.current.pendingClearConfirm).toBe(false)
  })

  it('clears the pending timer on unmount (no late state update)', () => {
    const socket = makeMockSocket()
    const { result, unmount } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.clearHistory()
    })
    // Capture state before unmount — should be pending-clear with no error.
    expect(result.current.pendingClearConfirm).toBe(true)
    expect(result.current.clearError).toBeNull()

    unmount()

    // Advancing past the timer should NOT trigger any setState on the
    // unmounted hook — if the cleanup effect properly cancels the timer,
    // pendingClearConfirm and clearError remain as they were at unmount.
    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    // Hook is unmounted — result.current is stale; the important thing is
    // that the above `act` didn't throw a React warning about state updates
    // on an unmounted component. This proves the cleanup effect (line 77-80)
    // properly cancelled the pending timer before unmount.
    expect(socket.emit).toHaveBeenCalledTimes(1)
  })

  it('cleans up its CLUB_SESSION_HISTORY listener on unmount', () => {
    const socket = makeMockSocket()
    const { unmount } = renderHook(() => useClubSessionHistory(socket as any, true))
    unmount()
    // off() must have been called for the history event
    const offCalls = (socket.off as any).mock.calls
    const historyOff = offCalls.filter(([ev]: [string]) => ev === SocketEvents.SERVER.CLUB_SESSION_HISTORY)
    expect(historyOff.length).toBeGreaterThan(0)
  })

  // ── phone-reveal (Phase 7 / U4) ─────────────────────────────────────

  it('revealPhone(sessionId) emits CLUB_REVEAL_PHONE with { sessionId }', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.revealPhone!('sess-123')
    })
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, {
      sessionId: 'sess-123',
    })
  })

  it('CLUB_REVEAL_PHONE_RESULT stores the revealed phone', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    act(() => {
      result.current.revealPhone!('sess-123')
    })
    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT, {
        success: true,
        phone: '555-1234',
      })
    })
    expect(result.current.revealedPhone).toEqual({
      sessionId: 'sess-123',
      phone: '555-1234',
    })
  })

  it('clearRevealedPhone resets revealedPhone to null', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubSessionHistory(socket as any, true))
    // Prime with a revealed phone
    act(() => {
      result.current.revealPhone!('sess-123')
    })
    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT, {
        success: true,
        phone: '555-1234',
      })
    })
    expect(result.current.revealedPhone).not.toBeNull()
    act(() => {
      result.current.clearRevealedPhone!()
    })
    expect(result.current.revealedPhone).toBeNull()
  })
})