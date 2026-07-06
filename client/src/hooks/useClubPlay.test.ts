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
    it('should emit CLUB_RECONNECT when MATCH_UPDATE has mode=club and clubStatus=OCCUPIED', () => {
      const { socket, trigger } = createMockSocket()

      renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, {
        ...makeLiveMatch(),
        mode: 'club',
        clubStatus: 'OCCUPIED',
      })

      expect(socket.emit).toHaveBeenCalledWith(
        SocketEvents.CLIENT.CLUB_RECONNECT,
        { courtId: MOCK_COURT_ID },
      )
    })

    it('should NOT emit CLUB_RECONNECT when match does not have club OCCUPIED status', () => {
      const { socket, trigger } = createMockSocket()

      // Clear any initial emit calls
      socket.emit.mockClear()

      renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, makeLiveMatch())

      expect(socket.emit).not.toHaveBeenCalledWith(
        SocketEvents.CLIENT.CLUB_RECONNECT,
        expect.any(Object),
      )
    })

    it('should set reconnecting=true when emitting CLUB_RECONNECT', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      trigger(SocketEvents.SERVER.MATCH_UPDATE, {
        ...makeLiveMatch(),
        mode: 'club',
        clubStatus: 'OCCUPIED',
      })

      expect(result.current.reconnecting).toBe(true)
    })

    it('should clear reconnecting on CLUB_RECONNECT_RESULT success', () => {
      const { socket, trigger } = createMockSocket()

      const { result } = renderHook(() => useClubPlay(socket as any, MOCK_COURT_ID, true))

      // Trigger reconnection
      trigger(SocketEvents.SERVER.MATCH_UPDATE, {
        ...makeLiveMatch(),
        mode: 'club',
        clubStatus: 'OCCUPIED',
      })
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

      const occupiedMatch = { ...makeLiveMatch(), mode: 'club' as const, clubStatus: 'OCCUPIED' as const }

      // First MATCH_UPDATE with OCCUPIED
      trigger(SocketEvents.SERVER.MATCH_UPDATE, occupiedMatch)

      // Second MATCH_UPDATE (e.g., live score update) — should NOT emit again
      trigger(SocketEvents.SERVER.MATCH_UPDATE, { ...occupiedMatch, score: { currentSet: { a: 1, b: 0 }, sets: { a: 0, b: 0 } } })

      const reconnectCalls = (socket.emit as any).mock.calls.filter(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
      )
      expect(reconnectCalls).toHaveLength(1)
    })
  })
})
