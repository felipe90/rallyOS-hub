/**
 * useRallyTapBridge integration tests — wires BLEBridge ↔ Socket.IO.
 *
 * Covers button-press forwarding (BLE → hub via RECORD_POINT),
 * MATCH_UPDATE receiving (hub → device via writeScore),
 * and lifecycle cleanup on unmount.
 *
 * @module hooks/useRallyTapBridge.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SocketEvents } from '@shared/events'
import { useRallyTapBridge } from './useRallyTapBridge'

// ── Mock BLEBridge ──────────────────────────────────────────────
//
// Capture the mock bridge instance in a module-level variable so
// tests can trigger callbacks registered by the hook.

let mockBridgeInstance: ReturnType<typeof createMockBridge>

function createMockBridge() {
  const callbacks: {
    buttonPress: ((player: 'A' | 'B') => void) | null
    connectionChange: ((state: string) => void) | null
    error: ((message: string) => void) | null
  } = {
    buttonPress: null,
    connectionChange: null,
    error: null,
  }

  const bridge = {
    onButtonPress: vi.fn((cb: (player: 'A' | 'B') => void) => {
      callbacks.buttonPress = cb
    }),
    onConnectionChange: vi.fn((cb: (state: string) => void) => {
      callbacks.connectionChange = cb
    }),
    onError: vi.fn((cb: (message: string) => void) => {
      callbacks.error = cb
    }),
    writeScore: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    getState: vi.fn(() => ({
      connected: true,
      deviceName: 'RallyTap-001',
    })),

    // Helpers for tests to fire the stored callbacks
    triggerButtonPress(player: 'A' | 'B') {
      callbacks.buttonPress?.(player)
    },
    triggerConnectionChange(state: string) {
      callbacks.connectionChange?.(state)
    },
    triggerError(message: string) {
      callbacks.error?.(message)
    },
  }

  return bridge
}

// Use a regular (non-arrow) function so that `new BLEBridge()` works —
// vi.fn with arrow-fn impl is not constructable.
vi.mock('@/services/ble/bridge', () => ({
  BLEBridge: function BLEBridge() {
    const instance = createMockBridge()
    mockBridgeInstance = instance
    return instance
  } as any,
}))

// ── Mock Socket factory (matches useClubPlay.test.ts pattern) ───

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
  }
}

// ── Tests ───────────────────────────────────────────────────────

const COURT_ID = 'test-court'

describe('useRallyTapBridge', () => {
  beforeEach(() => {
    mockBridgeInstance = undefined as any
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. BLE button press → RECORD_POINT ────────────────────────

  it('should emit RECORD_POINT when bridge button press fires for player A', () => {
    const { socket } = createMockSocket()

    renderHook(() => useRallyTapBridge(socket as any, COURT_ID))

    // Simulate a button press from the BLE bridge
    mockBridgeInstance.triggerButtonPress('A')

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.RECORD_POINT,
      { courtId: COURT_ID, player: 'A' },
    )
  })

  it('should emit RECORD_POINT when bridge button press fires for player B', () => {
    const { socket } = createMockSocket()

    renderHook(() => useRallyTapBridge(socket as any, COURT_ID))

    mockBridgeInstance.triggerButtonPress('B')

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.RECORD_POINT,
      { courtId: COURT_ID, player: 'B' },
    )
  })

  // ── 2. MATCH_UPDATE → writeScore ──────────────────────────────

  it('should call bridge.writeScore on MATCH_UPDATE with correct score payload', () => {
    const { socket, trigger } = createMockSocket()

    renderHook(() => useRallyTapBridge(socket as any, COURT_ID))

    trigger(SocketEvents.SERVER.MATCH_UPDATE, {
      score: {
        currentSet: { a: 3, b: 2 },
        sets: { a: 1, b: 0 },
      },
    })

    expect(mockBridgeInstance.writeScore).toHaveBeenCalledWith({
      a: 3,
      b: 2,
      set_a: 1,
      set_b: 0,
      status: 'ok',
      msg: '',
    })
  })

  it('should default score fields to 0 when MATCH_UPDATE has no score', () => {
    const { socket, trigger } = createMockSocket()

    renderHook(() => useRallyTapBridge(socket as any, COURT_ID))

    trigger(SocketEvents.SERVER.MATCH_UPDATE, {})

    expect(mockBridgeInstance.writeScore).toHaveBeenCalledWith({
      a: 0,
      b: 0,
      set_a: 0,
      set_b: 0,
      status: 'ok',
      msg: '',
    })
  })

  // ── 3. Lifecycle cleanup on unmount ───────────────────────────

  it('should disconnect bridge and remove socket listeners on unmount', () => {
    const { socket } = createMockSocket()

    const { unmount } = renderHook(() =>
      useRallyTapBridge(socket as any, COURT_ID),
    )

    unmount()

    // Bridge disconnect called
    expect(mockBridgeInstance.disconnect).toHaveBeenCalled()

    // Socket listeners removed
    expect(socket.off).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_UPDATE,
      expect.any(Function),
    )
    expect(socket.off).toHaveBeenCalledWith(
      SocketEvents.SERVER.ERROR,
      expect.any(Function),
    )
  })
})
