import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSocketState } from './useSocketState'
import { SocketEvents } from '@shared/events'
import { COURT_MODE, BRACKET_STATUS } from '@shared/types'
import type { CourtInfo, KioskNotificationData, TournamentBracket } from '@shared/types'

/**
 * Creates a mock Socket that stores event handlers so we can trigger them.
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
    /** Assert that a listener was registered for the given event */
    expectListenerRegistered(event: string) {
      expect(socket.on).toHaveBeenCalledWith(event, expect.any(Function))
    },
  }
}

// ── Helper factories ─────────────────────────────────────────────────

function createMockCourt(overrides: Partial<CourtInfo> = {}): CourtInfo {
  return {
    id: 'court-1',
    number: 1,
    name: 'Cancha 1',
    status: 'LIVE',
    playerCount: 2,
    mode: COURT_MODE.TOURNAMENT,
    ...overrides,
  }
}

describe('useSocketState — court filtering (club court leak fix)', () => {
  it('should NOT add a club court to courts[] on COURT_UPDATE', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    const clubCourt = createMockCourt({ id: 'club-1', mode: COURT_MODE.CLUB })
    trigger(SocketEvents.SERVER.COURT_UPDATE, clubCourt)

    expect(result.current.courts).toHaveLength(0)
  })

  it('should add a tournament court to courts[] on COURT_UPDATE', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    const tourneyCourt = createMockCourt({ id: 'tourney-1', mode: COURT_MODE.TOURNAMENT })
    trigger(SocketEvents.SERVER.COURT_UPDATE, tourneyCourt)

    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].id).toBe('tourney-1')
  })

  it('should accept a court with undefined mode (backward compat) on COURT_UPDATE', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    const legacyCourt = createMockCourt({ id: 'legacy-1', mode: undefined })
    trigger(SocketEvents.SERVER.COURT_UPDATE, legacyCourt)

    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].id).toBe('legacy-1')
  })

  it('should NOT add a club court to courts[] on COURT_CREATED', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    const clubCourt = createMockCourt({ id: 'club-2', mode: COURT_MODE.CLUB })
    trigger(SocketEvents.SERVER.COURT_CREATED, clubCourt)

    expect(result.current.courts).toHaveLength(0)
  })

  it('should add a tournament court to courts[] on COURT_CREATED', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    const tourneyCourt = createMockCourt({ id: 'tourney-2', mode: COURT_MODE.TOURNAMENT })
    trigger(SocketEvents.SERVER.COURT_CREATED, tourneyCourt)

    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].id).toBe('tourney-2')
  })

  it('should update an existing tournament court on COURT_UPDATE (upsert)', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    const court = createMockCourt({ id: 'court-1', name: 'Original', mode: COURT_MODE.TOURNAMENT })
    trigger(SocketEvents.SERVER.COURT_UPDATE, court)
    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].name).toBe('Original')

    const updated = { ...court, name: 'Updated' }
    trigger(SocketEvents.SERVER.COURT_UPDATE, updated)
    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].name).toBe('Updated')
  })
})

describe('useSocketState — kioskNotification', () => {
  const mockNotification: KioskNotificationData = {
    type: 'info',
    message: 'Test notification',
    duration: 5,
    timestamp: Date.now(),
  }

  it('sets kioskNotification when KIOSK_NOTIFICATION event fires', () => {
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useSocketState(socket))

    // Trigger the KIOSK_NOTIFICATION event
    trigger(SocketEvents.SERVER.KIOSK_NOTIFICATION, mockNotification)

    expect(result.current.kioskNotification).toEqual(mockNotification)
  })

  it('clears kioskNotification when KIOSK_NOTIFICATION event fires with null', () => {
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useSocketState(socket))

    // First set a notification
    trigger(SocketEvents.SERVER.KIOSK_NOTIFICATION, mockNotification)
    expect(result.current.kioskNotification).toEqual(mockNotification)

    // Then clear it with null
    trigger(SocketEvents.SERVER.KIOSK_NOTIFICATION, null)
    expect(result.current.kioskNotification).toBeNull()
  })

  it('registers KIOSK_NOTIFICATION listener on mount', () => {
    const { socket, expectListenerRegistered } = createMockSocket()

    renderHook(() => useSocketState(socket))

    expectListenerRegistered(SocketEvents.SERVER.KIOSK_NOTIFICATION)
  })

  it('unregisters KIOSK_NOTIFICATION listener on unmount', () => {
    const { socket } = createMockSocket()

    const { unmount } = renderHook(() => useSocketState(socket))

    unmount()

    expect(socket.off).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.any(Function),
    )
  })

  it('starts with kioskNotification as null before any event', () => {
    const { socket } = createMockSocket()

    const { result } = renderHook(() => useSocketState(socket))

    expect(result.current.kioskNotification).toBeNull()
  })

  it('replaces previous notification when new KIOSK_NOTIFICATION fires', () => {
    const { socket, trigger } = createMockSocket()

    const { result } = renderHook(() => useSocketState(socket))

    const first: KioskNotificationData = {
      type: 'info',
      message: 'First',
      duration: 5,
      timestamp: 1000,
    }
    const second: KioskNotificationData = {
      type: 'warning',
      message: 'Second',
      duration: 10,
      timestamp: 2000,
    }

    trigger(SocketEvents.SERVER.KIOSK_NOTIFICATION, first)
    expect(result.current.kioskNotification).toEqual(first)

    trigger(SocketEvents.SERVER.KIOSK_NOTIFICATION, second)
    expect(result.current.kioskNotification).toEqual(second)
    expect(result.current.kioskNotification?.type).toBe('warning')
  })

  it('returns null when socket is null (no listener registered)', () => {
    const { result } = renderHook(() => useSocketState(null))

    expect(result.current.kioskNotification).toBeNull()
  })
})

describe('useSocketState — bracket (kiosk bracket mode)', () => {
  function makeBracket(overrides: Partial<TournamentBracket> = {}): TournamentBracket {
    return {
      name: 'Torneo',
      numSlots: 4,
      includeThirdPlace: false,
      matches: [],
      thirdPlaceMatch: null,
      status: BRACKET_STATUS.SETUP,
      createdAt: 1000,
      ...overrides,
    }
  }

  it('starts with bracket as null before any event', () => {
    const { socket } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))
    expect(result.current.bracket).toBeNull()
  })

  it('sets bracket when BRACKET_STATE event fires', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    trigger(SocketEvents.SERVER.BRACKET_STATE, makeBracket({ name: 'Cuadro' }))

    expect(result.current.bracket).not.toBeNull()
    expect(result.current.bracket?.name).toBe('Cuadro')
  })

  it('clears bracket when BRACKET_STATE fires with null', () => {
    const { socket, trigger } = createMockSocket()
    const { result } = renderHook(() => useSocketState(socket))

    trigger(SocketEvents.SERVER.BRACKET_STATE, makeBracket())
    expect(result.current.bracket).not.toBeNull()

    trigger(SocketEvents.SERVER.BRACKET_STATE, null)
    expect(result.current.bracket).toBeNull()
  })

  it('registers BRACKET_STATE listener on mount', () => {
    const { socket, expectListenerRegistered } = createMockSocket()
    renderHook(() => useSocketState(socket))
    expectListenerRegistered(SocketEvents.SERVER.BRACKET_STATE)
  })

  it('returns null bracket when socket is null (no listener registered)', () => {
    const { result } = renderHook(() => useSocketState(null))
    expect(result.current.bracket).toBeNull()
  })
})
