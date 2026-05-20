import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSocketState } from './useSocketState'
import { SocketEvents } from '@shared/events'
import type { KioskNotificationData } from '@shared/types'

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
