import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClubPlay } from './useClubPlay'
import { SocketEvents } from '@shared/events'
import type { MatchStateExtended } from '@shared/types'

/**
 * Creates a mock Socket with stored event handlers and a trigger utility.
 */
function createMockSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>()

  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler)
    }),
    off: vi.fn((event: string, _handler: (...args: unknown[]) => void) => {
      handlers.delete(event)
    }),
    emit: vi.fn(),
    connected: true,
  }

  return {
    socket,
    trigger(event: string, ...args: unknown[]) {
      const handler = handlers.get(event)
      if (handler) {
        act(() => handler(...args))
      }
    },
    expectListenerRegistered(event: string) {
      expect(socket.on).toHaveBeenCalledWith(event, expect.any(Function))
    },
  }
}

const MOCK_COURT_ID = 'court-123'

function makeLiveMatch(overrides: Partial<MatchStateExtended> = {}): MatchStateExtended {
  return {
    courtId: MOCK_COURT_ID,
    status: 'LIVE',
    config: { sport: 'padel', bestOf: 1, gamesPerSet: 6, tiebreakPoints: 7, goldenPoint: false },
    score: { currentSet: { a: 0, b: 0 }, sets: { a: 0, b: 0 } },
    history: [],
    playerNames: { a: 'Jugador 1', b: 'Jugador 2' },
    setHistory: [],
    ...overrides,
  }
}

describe('useClubPlay', () => {
  it('should register MATCH_UPDATE listener on mount', () => {
    const { socket } = createMockSocket()

    renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_UPDATE,
      expect.any(Function),
    )
  })

  it('should emit GET_MATCH_STATE on mount when connected', () => {
    const { socket } = createMockSocket()

    renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.GET_MATCH_STATE,
      { courtId: MOCK_COURT_ID },
    )
  })

  it('should not emit GET_MATCH_STATE when not connected', () => {
    const { socket } = createMockSocket()

    renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('should not emit GET_MATCH_STATE when courtId is empty', () => {
    const { socket } = createMockSocket()

    renderHook(() => useClubPlay(socket as any, '', true))

    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('should not register listeners when socket is null', () => {
    expect(() => {
      renderHook(() => useClubPlay(null, MOCK_COURT_ID, true))
    }).not.toThrow()
  })

  it('should update matchState on MATCH_UPDATE for the correct courtId', () => {
    // Set up the club PIN so the CLUB_RECONNECT logic (REQ-10) does not
    // set SESSION_EXPIRED on non-FINISHED matches.
    sessionStorage.setItem('rallyos-club-pin', '1111')
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

    const matchUpdate = makeLiveMatch({ score: { currentSet: { a: 3, b: 2 }, sets: { a: 0, b: 0 } } })
    trigger(SocketEvents.SERVER.MATCH_UPDATE, matchUpdate)

    expect(result.current.matchState?.score.currentSet.a).toBe(3)
    expect(result.current.matchState?.score.currentSet.b).toBe(2)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should NOT update matchState for a different courtId', () => {
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

    trigger(SocketEvents.SERVER.MATCH_UPDATE, {
      ...makeLiveMatch(),
      courtId: 'other-court',
    })

    expect(result.current.matchState).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('should set finished=true when MATCH_UPDATE has status=FINISHED', () => {
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

    trigger(SocketEvents.SERVER.MATCH_UPDATE, {
      ...makeLiveMatch(),
      status: 'FINISHED' as any,
      winner: 'A',
    })

    expect(result.current.finished).toBe(true)
  })

  it('should set loading=false on MATCH_UPDATE', () => {
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

    expect(result.current.loading).toBe(true)

    trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())

    expect(result.current.loading).toBe(false)
  })

  describe('scorePoint', () => {
    it('should emit RECORD_POINT with player and courtId', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.scorePoint('A'))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.RECORD_POINT, {
        player: 'A',
        courtId: MOCK_COURT_ID,
      })
    })

    it('should not emit when not connected', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

      act(() => result.current.scorePoint('B'))

      expect(socket.emit).not.toHaveBeenCalled()
    })
  })

  describe('subtractPoint', () => {
    it('should emit SUBTRACT_POINT with player and courtId', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.subtractPoint('A'))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.SUBTRACT_POINT, {
        player: 'A',
        courtId: MOCK_COURT_ID,
      })
    })
  })

  describe('undoLast', () => {
    it('should emit UNDO_LAST with courtId', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.undoLast())

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.UNDO_LAST, {
        courtId: MOCK_COURT_ID,
      })
    })
  })

  describe('swapSides', () => {
    it('should emit SWAP_SIDES with courtId', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.swapSides())

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.SWAP_SIDES, {
        courtId: MOCK_COURT_ID,
      })
    })
  })

  describe('startMatch', () => {
    it('should emit START_MATCH with player names and bestOf=1', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.startMatch('Alice', 'Bob'))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.START_MATCH, {
        courtId: MOCK_COURT_ID,
        playerNameA: 'Alice',
        playerNameB: 'Bob',
        bestOf: 1,
      })
    })

    it('should not emit when not connected', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

      act(() => result.current.startMatch('A', 'B'))

      expect(socket.emit).not.toHaveBeenCalled()
    })
  })

  describe('reconnection — CLUB_RECONNECT', () => {
    beforeEach(() => {
      // The hook reads the club PIN from sessionStorage for CLUB_RECONNECT
      // (REQ-10). Without it, a non-FINISHED MATCH_UPDATE sets
      // SESSION_EXPIRED instead of emitting CLUB_RECONNECT.
      sessionStorage.setItem('rallyos-club-pin', '1111')
    })

    afterEach(() => {
      sessionStorage.removeItem('rallyos-club-pin')
    })

    it('should emit CLUB_RECONNECT when MATCH_UPDATE has LIVE status (active club court)', () => {
      const { socket, trigger } = createMockSocket()

      renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Clear the initial GET_MATCH_STATE emit
      socket.emit.mockClear()

      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())

      expect(socket.emit).toHaveBeenCalledWith(
        SocketEvents.CLIENT.CLUB_RECONNECT,
        { courtId: MOCK_COURT_ID, pin: '1111' },
      )
    })

    it('should NOT emit CLUB_RECONNECT when match is FINISHED', () => {
      const { socket, trigger } = createMockSocket()

      // Clear any initial emit calls
      socket.emit.mockClear()

      renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, {
        ...makeLiveMatch(),
        status: 'FINISHED',
      })

      expect(socket.emit).not.toHaveBeenCalledWith(
        SocketEvents.CLIENT.CLUB_RECONNECT,
        expect.any(Object),
      )
    })

    it('should set reconnecting=true when emitting CLUB_RECONNECT', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())

      expect(result.current.reconnecting).toBe(true)
    })

    it('should clear reconnecting on CLUB_RECONNECT_RESULT success', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Trigger reconnection
      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())
      expect(result.current.reconnecting).toBe(true)

      // Receive success
      trigger(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: true,
        courtId: MOCK_COURT_ID,
        matchState: makeLiveMatch({ score: { currentSet: { a: 2, b: 1 }, sets: { a: 0, b: 0 } } }),
      })

      expect(result.current.reconnecting).toBe(false)
      expect(result.current.matchState?.score.currentSet.a).toBe(2)
    })

    it('should set error on CLUB_RECONNECT_RESULT failure', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: false,
        error: 'COURT_NOT_OCCUPIED',
      })

      expect(result.current.error).toBe('COURT_NOT_OCCUPIED')
    })

    it('should set refereeReplaced=true on REF_REVOKED', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.REF_REVOKED, { courtId: MOCK_COURT_ID })

      expect(result.current.refereeReplaced).toBe(true)
    })

    it('should NOT set refereeReplaced for a different courtId', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.REF_REVOKED, { courtId: 'other-court' })

      expect(result.current.refereeReplaced).toBe(false)
    })

    it('should only emit CLUB_RECONNECT once even with multiple MATCH_UPDATE events', () => {
      const { socket, trigger } = createMockSocket()

      renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Clear the initial GET_MATCH_STATE emit
      socket.emit.mockClear()

      // First MATCH_UPDATE with LIVE status
      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())

      // Second MATCH_UPDATE (e.g., live score update) — should NOT emit again
      trigger(SocketEvents.SERVER.MATCH_UPDATE, {
        ...makeLiveMatch(),
        score: { currentSet: { a: 1, b: 0 }, sets: { a: 0, b: 0 } },
      })

      const reconnectCalls = (socket.emit as any).mock.calls.filter(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
      )
      expect(reconnectCalls).toHaveLength(1)
    })
  })

  describe('sessionEnded', () => {
    it('should set sessionEnded data on CLUB_SESSION_ENDED for the correct courtId', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId: MOCK_COURT_ID,
        elapsedMinutes: 15,
        cost: 750,
        currency: 'ARS',
        reason: 'player',
      })

      expect(result.current.sessionEnded).not.toBeNull()
      expect(result.current.sessionEnded!.elapsedMinutes).toBe(15)
      expect(result.current.sessionEnded!.cost).toBe(750)
      expect(result.current.sessionEnded!.currency).toBe('ARS')
      expect(result.current.sessionEnded!.reason).toBe('player')
    })

    it('should NOT set sessionEnded for a different courtId', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId: 'other-court',
        elapsedMinutes: 10,
        cost: 500,
        currency: 'ARS',
        reason: 'auto',
      })

      expect(result.current.sessionEnded).toBeNull()
    })

    it('should set sessionEnded with cost=0 for free sessions', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId: MOCK_COURT_ID,
        elapsedMinutes: 5,
        cost: 0,
        currency: 'ARS',
        reason: 'force',
      })

      expect(result.current.sessionEnded).not.toBeNull()
      expect(result.current.sessionEnded!.cost).toBe(0)
      expect(result.current.sessionEnded!.reason).toBe('force')
    })
  })

  describe('endSession', () => {
    it('should emit CLUB_END_SESSION with courtId and confirm=false by default', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.endSession())

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_END_SESSION, {
        courtId: MOCK_COURT_ID,
        confirm: false,
      })
    })

    it('should emit CLUB_END_SESSION with confirm=true when passed', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.endSession(true))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_END_SESSION, {
        courtId: MOCK_COURT_ID,
        confirm: true,
      })
    })

    it('should not emit when not connected', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

      act(() => result.current.endSession())

      expect(socket.emit).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // PR 3 — Club session lifecycle: sessionMode, elapsed tracking,
  // post-match and end-session helpers, reconnect sessionMode/elapsed
  // consumption. Covers spec scenarios 1, 2, 4, 5, 6, 7, 8.
  // ─────────────────────────────────────────────────────────────────
  describe('club session lifecycle — sessionMode and elapsed', () => {
    beforeEach(() => {
      sessionStorage.setItem('rallyos-club-pin', '1111')
    })

    afterEach(() => {
      sessionStorage.removeItem('rallyos-club-pin')
    })

    it('initial sessionMode is null and elapsedSeconds is 0', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      expect(result.current.sessionMode).toBeNull()
      expect(result.current.elapsedSeconds).toBe(0)
      expect(result.current.pendingEndSessionConfirm).toBe(false)
    })

    // Scenario 1 — Start free play
    it('scenario 1: startFreePlay emits CLUB_START_FREE with courtId', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.startFreePlay())

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_START_FREE, {
        courtId: MOCK_COURT_ID,
      })
    })

    it('scenario 1: CLUB_FREE_STARTED sets sessionMode=free', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_FREE_STARTED, { courtId: MOCK_COURT_ID })

      expect(result.current.sessionMode).toBe('free')
    })

    it('CLUB_FREE_STARTED for a different courtId does not change sessionMode', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_FREE_STARTED, { courtId: 'other-court' })

      expect(result.current.sessionMode).toBeNull()
    })

    it('startFreePlay does not emit when not connected', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

      act(() => result.current.startFreePlay())

      expect(socket.emit).not.toHaveBeenCalled()
    })

    // Scenario 2 — Start match via CLUB_NEW_MATCH
    it('scenario 2: newMatch emits CLUB_NEW_MATCH with player names and courtId', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.newMatch('Alice', 'Bob'))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_NEW_MATCH, {
        courtId: MOCK_COURT_ID,
        playerNameA: 'Alice',
        playerNameB: 'Bob',
      })
    })

    it('scenario 2: newMatch forwards optional matchConfig when provided', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.newMatch('Alice', 'Bob', { pointsPerSet: 21, bestOf: 5 }))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_NEW_MATCH, {
        courtId: MOCK_COURT_ID,
        playerNameA: 'Alice',
        playerNameB: 'Bob',
        matchConfig: { pointsPerSet: 21, bestOf: 5 },
      })
    })

    it('scenario 2: LIVE MATCH_UPDATE does NOT set sessionMode (ClubSessionConfig shown instead)', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // First MATCH_UPDATE from GET_MATCH_STATE — sessionMode is NOT set
      // by MATCH_UPDATE. It stays null so ClubSessionConfig renders.
      // sessionMode is set by CLUB_FREE_STARTED (free) or newMatch (match)
      // or CLUB_RECONNECT_RESULT (page refresh).
      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())

      expect(result.current.sessionMode).toBeNull()
    })

    it('newMatch sets sessionMode=match optimistically before the server responds', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.newMatch('Alice', 'Bob'))

      expect(result.current.sessionMode).toBe('match')
    })

    it('MATCH_UPDATE with FINISHED status preserves sessionMode (not cleared by MATCH_UPDATE)', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Set sessionMode via newMatch before any MATCH_UPDATE
      act(() => result.current.newMatch('A', 'B'))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, {
        ...makeLiveMatch(),
        status: 'FINISHED' as any,
        winner: 'A',
      })

      expect(result.current.sessionMode).toBe('match')
      expect(result.current.finished).toBe(true)
    })

    it('newMatch does not emit when not connected', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

      act(() => result.current.newMatch('A', 'B'))

      expect(socket.emit).not.toHaveBeenCalled()
    })

    // resetMatch — post-match Reset action
    it('resetMatch emits CLUB_RESET_MATCH with courtId', () => {
      const { socket } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.resetMatch())

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_RESET_MATCH, {
        courtId: MOCK_COURT_ID,
      })
    })

    it('CLUB_MATCH_RESET updates matchState with the zeroed state and keeps sessionMode=match', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Set sessionMode via newMatch (simulate prior mode selection)
      act(() => result.current.newMatch('A', 'B'))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch({
        score: { currentSet: { a: 5, b: 4 }, sets: { a: 1, b: 0 } },
      }))
      expect(result.current.sessionMode).toBe('match')

      const zeroed = makeLiveMatch({ score: { currentSet: { a: 0, b: 0 }, sets: { a: 0, b: 0 } } })
      trigger(SocketEvents.SERVER.CLUB_MATCH_RESET, { courtId: MOCK_COURT_ID, matchState: zeroed })

      expect(result.current.matchState?.score.currentSet.a).toBe(0)
      expect(result.current.matchState?.score.currentSet.b).toBe(0)
      expect(result.current.sessionMode).toBe('match')
    })

    it('CLUB_MATCH_RESET for a different courtId does not overwrite matchState', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch({
        score: { currentSet: { a: 5, b: 4 }, sets: { a: 1, b: 0 } },
      }))

      trigger(SocketEvents.SERVER.CLUB_MATCH_RESET, {
        courtId: 'other-court',
        matchState: makeLiveMatch({ score: { currentSet: { a: 0, b: 0 }, sets: { a: 0, b: 0 } } }),
      })

      expect(result.current.matchState?.score.currentSet.a).toBe(5)
    })

    // Scenario 4 — Session ended resets sessionMode
    it('scenario 4: CLUB_SESSION_ENDED resets sessionMode to null', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Set sessionMode via newMatch (simulate prior mode selection)
      act(() => result.current.newMatch('A', 'B'))
      expect(result.current.sessionMode).toBe('match')

      trigger(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId: MOCK_COURT_ID,
        elapsedMinutes: 15,
        cost: 750,
        currency: 'ARS',
        reason: 'player',
      })

      expect(result.current.sessionMode).toBeNull()
      expect(result.current.pendingEndSessionConfirm).toBe(false)
    })

    // Scenario 5a — Confirmation request arrives
    it('scenario 5a: CLUB_END_SESSION_CONFIRM arms pendingEndSessionConfirm and sets elapsedSeconds', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, {
        courtId: MOCK_COURT_ID,
        elapsedSeconds: 930,
      })

      expect(result.current.pendingEndSessionConfirm).toBe(true)
      expect(result.current.elapsedSeconds).toBe(930)
    })

    it('scenario 5a: CLUB_END_SESSION_CONFIRM for a different courtId is ignored', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, {
        courtId: 'other-court',
        elapsedSeconds: 100,
      })

      expect(result.current.pendingEndSessionConfirm).toBe(false)
      expect(result.current.elapsedSeconds).toBe(0)
    })

    // Scenario 5b — Confirm emit clears pending state
    it('scenario 5b: endSession(true) emits confirm=true and clears pendingEndSessionConfirm', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, {
        courtId: MOCK_COURT_ID,
        elapsedSeconds: 120,
      })
      expect(result.current.pendingEndSessionConfirm).toBe(true)

      act(() => result.current.endSession(true))

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_END_SESSION, {
        courtId: MOCK_COURT_ID,
        confirm: true,
      })
      expect(result.current.pendingEndSessionConfirm).toBe(false)
    })

    // Scenario 6 — Cancel: client just doesn't emit confirm; local state reset via cancelEndSession
    it('scenario 6: cancelEndSession clears pendingEndSessionConfirm without emitting', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, {
        courtId: MOCK_COURT_ID,
        elapsedSeconds: 60,
      })
      expect(result.current.pendingEndSessionConfirm).toBe(true)

      socket.emit.mockClear()
      act(() => result.current.cancelEndSession())

      expect(socket.emit).not.toHaveBeenCalled()
      expect(result.current.pendingEndSessionConfirm).toBe(false)
    })

    // Scenario 7 — Reconnect during match
    it('scenario 7: CLUB_RECONNECT_RESULT success with sessionMode=match sets sessionMode and elapsedSeconds', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: true,
        courtId: MOCK_COURT_ID,
        matchState: makeLiveMatch(),
        sessionMode: 'match',
        elapsedSeconds: 1234,
      })

      expect(result.current.sessionMode).toBe('match')
      expect(result.current.elapsedSeconds).toBe(1234)
      expect(result.current.reconnecting).toBe(false)
    })

    // Scenario 8 — Reconnect during free play
    it('scenario 8: CLUB_RECONNECT_RESULT success with sessionMode=free sets sessionMode=free and elapsedSeconds', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: true,
        courtId: MOCK_COURT_ID,
        sessionMode: 'free',
        elapsedSeconds: 540,
      })

      expect(result.current.sessionMode).toBe('free')
      expect(result.current.elapsedSeconds).toBe(540)
    })

    it('CLUB_RECONNECT_RESULT failure does not change sessionMode or elapsedSeconds', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: false,
        error: 'INVALID_PIN',
      })

      expect(result.current.sessionMode).toBeNull()
      expect(result.current.elapsedSeconds).toBe(0)
    })

    // Periodic server sync — CLUB_SESSION_TIMER
    it('CLUB_SESSION_TIMER updates elapsedSeconds from the server sync', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_SESSION_TIMER, {
        courtId: MOCK_COURT_ID,
        elapsedSeconds: 312,
      })

      expect(result.current.elapsedSeconds).toBe(312)
    })

    it('CLUB_SESSION_TIMER for a different courtId is ignored', () => {
      const { socket, trigger } = createMockSocket()
      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.CLUB_SESSION_TIMER, {
        courtId: 'other-court',
        elapsedSeconds: 999,
      })

      expect(result.current.elapsedSeconds).toBe(0)
    })
  })
})
