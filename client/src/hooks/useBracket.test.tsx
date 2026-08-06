import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBracket } from './useBracket'
import { SocketEvents } from '@shared/events'
import type { TournamentBracket, BracketMatch } from '@shared/types'

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
      if (handler) act(() => handler(...args))
    },
  }
}

function makeMatch(overrides: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id: 'R1-M1',
    round: 1,
    position: 0,
    playerA: 'Alice',
    playerB: 'Bob',
    winner: null,
    status: 'READY',
    courtId: null,
    ...overrides,
  }
}

function makeBracket(overrides: Partial<TournamentBracket> = {}): TournamentBracket {
  return {
    name: 'Torneo Test',
    numSlots: 4,
    includeThirdPlace: false,
    matches: [makeMatch()],
    thirdPlaceMatch: null,
    status: 'SETUP',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('useBracket — initial state', () => {
  it('returns null bracket and error when socket present', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    expect(result.current.bracket).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.resetToken).toBeNull()
  })

  it('returns null bracket and error when socket is null', () => {
    const { result } = renderHook(() => useBracket(null))
    expect(result.current.bracket).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('useBracket — emit actions', () => {
  it('createBracket emits BRACKET_CREATE with name/numSlots/includeThirdPlace', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.createBracket('Cuatro', 8, true))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: 'Cuatro',
      numSlots: 8,
      includeThirdPlace: true,
    })
  })

  it('createBracket defaults includeThirdPlace to false', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.createBracket('Def', 16))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: 'Def',
      numSlots: 16,
      includeThirdPlace: false,
    })
  })

  it('assignPlayer emits BRACKET_ASSIGN_PLAYER with { matchId, slot, name }', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.assignPlayer('R1-M1', 'A', 'Alice'))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
      matchId: 'R1-M1',
      slot: 'A',
      name: 'Alice',
    })
  })

  it('assignPlayer emits with empty string name when given empty (clears slot)', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.assignPlayer('R1-M1', 'B', ''))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
      matchId: 'R1-M1',
      slot: 'B',
      name: '',
    })
  })

  it('setWinner emits BRACKET_SET_WINNER with { matchId, winner }', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.setWinner('R1-M1', 'A'))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_SET_WINNER, {
      matchId: 'R1-M1',
      winner: 'A',
    })
  })

  it('assignCourt emits BRACKET_ASSIGN_COURT with { matchId, courtId }', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.assignCourt('R1-M1', 'court-9'))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
      matchId: 'R1-M1',
      courtId: 'court-9',
    })
  })

  it('assignCourt accepts null courtId to clear', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.assignCourt('R1-M1', null))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
      matchId: 'R1-M1',
      courtId: null,
    })
  })

  it('selectTable emits TOURNAMENT_SELECT_TABLE with { matchId, courtId } (D13 owner picker)', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.selectTable('R1-M1', 'court-9'))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M1',
      courtId: 'court-9',
    })
  })

  it('undoMatch emits BRACKET_UNDO_MATCH with { matchId }', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.undoMatch('R1-M1'))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_UNDO_MATCH, {
      matchId: 'R1-M1',
    })
  })

  it('getBracket emits BRACKET_GET with no payload', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.getBracket())
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_GET, undefined)
  })

  it('reset() with no token emits BRACKET_RESET with empty payload (step 1)', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.reset())
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_RESET, {
      confirmToken: undefined,
    })
  })

  it('resetConfirm(token) emits BRACKET_RESET with confirmToken (step 2)', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    act(() => result.current.resetConfirm('tok-123'))
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.BRACKET_RESET, {
      confirmToken: 'tok-123',
    })
  })

  it('all actions are no-ops when socket is null', () => {
    const { result } = renderHook(() => useBracket(null))
    expect(() => act(() => result.current.createBracket('x', 4))).not.toThrow()
    expect(() => act(() => result.current.setWinner('R1-M1', 'A'))).not.toThrow()
    expect(() => act(() => result.current.reset())).not.toThrow()
  })
})

describe('useBracket — incoming state', () => {
  it('BRACKET_STATE replaces bracket', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    const bracket = makeBracket()
    trigger(SocketEvents.SERVER.BRACKET_STATE, bracket)
    expect(result.current.bracket).toEqual(bracket)
  })

  it('BRACKET_STATE null clears bracket', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    trigger(SocketEvents.SERVER.BRACKET_STATE, makeBracket())
    expect(result.current.bracket).not.toBeNull()
    trigger(SocketEvents.SERVER.BRACKET_STATE, null)
    expect(result.current.bracket).toBeNull()
  })

  it('BRACKET_ERROR sets error { code, message }', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    trigger(SocketEvents.SERVER.BRACKET_ERROR, { code: 'INVALID_SIZE', message: 'bad' })
    expect(result.current.error).toEqual({ code: 'INVALID_SIZE', message: 'bad' })
  })

  it('BRACKET_RESET_CONFIRM stores resetToken and expiresIn', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    trigger(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, { token: 'tok-9', expiresIn: 30 })
    expect(result.current.resetToken).toBe('tok-9')
    expect(result.current.resetExpiresIn).toBe(30)
  })
})

describe('useBracket — error clearing', () => {
  it('clearError resets error to null', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    trigger(SocketEvents.SERVER.BRACKET_ERROR, { code: 'X', message: 'y' })
    expect(result.current.error).not.toBeNull()
    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })

  it('a new BRACKET_STATE clears any pending error', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    trigger(SocketEvents.SERVER.BRACKET_ERROR, { code: 'X', message: 'y' })
    trigger(SocketEvents.SERVER.BRACKET_STATE, makeBracket())
    expect(result.current.error).toBeNull()
  })

  it('a successful BRACKET_RESET_CONFIRM clears any pending error', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useBracket(socket))
    trigger(SocketEvents.SERVER.BRACKET_ERROR, { code: 'X', message: 'y' })
    trigger(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, { token: 't', expiresIn: 30 })
    expect(result.current.error).toBeNull()
  })
})

describe('useBracket — listener registration', () => {
  it('registers BRACKET_STATE, BRACKET_ERROR, BRACKET_RESET_CONFIRM on mount', () => {
    const { socket } = createMockSocket()
    renderHook(() => useBracket(socket))
    expect(socket.on).toHaveBeenCalledWith(SocketEvents.SERVER.BRACKET_STATE, expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith(SocketEvents.SERVER.BRACKET_ERROR, expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, expect.any(Function))
  })

  it('unregisters all listeners on unmount', () => {
    const { socket } = createMockSocket()
    const { unmount } = renderHook(() => useBracket(socket))
    unmount()
    expect(socket.off).toHaveBeenCalledWith(SocketEvents.SERVER.BRACKET_STATE, expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith(SocketEvents.SERVER.BRACKET_ERROR, expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, expect.any(Function))
  })

  it('does not register listeners when socket is null', () => {
    const { result } = renderHook(() => useBracket(null))
    // Smoke: accessing result fields never threw
    expect(result.current.bracket).toBeNull()
  })
})