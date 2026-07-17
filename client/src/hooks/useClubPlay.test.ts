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
    it('should emit CLUB_END_SESSION with courtId', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      act(() => result.current.endSession())

      expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_END_SESSION, {
        courtId: MOCK_COURT_ID,
      })
    })

    it('should not emit when not connected', () => {
      const { socket } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, false))

      act(() => result.current.endSession())

      expect(socket.emit).not.toHaveBeenCalled()
    })
  })
})
