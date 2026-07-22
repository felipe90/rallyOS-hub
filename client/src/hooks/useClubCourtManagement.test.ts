/**
 * useClubCourtManagement tests (Phase 6.3)
 *
 * Tests adminOccupyCourt emitter — the hook's role is to emit
 * CLUB_ADMIN_OCCUPY with the already-encrypted phone payload.
 * Phone encryption happens in the calling component (AdminOccupyModal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { useClubCourtManagement } from './useClubCourtManagement'

function createMockSocket(): Partial<Socket> {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler)
      return {} as Socket
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event)
      return {} as Socket
    }),
    emit: vi.fn(),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler)
      return {} as Socket
    }),
  }
}

describe('useClubCourtManagement — adminOccupyCourt (Phase 6.3)', () => {
  let mockSocket: Partial<Socket>

  beforeEach(() => {
    mockSocket = createMockSocket()
    vi.clearAllMocks()
  })

  it('emits CLUB_ADMIN_OCCUPY with courtId, playerName, phone, mode', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as Socket, true),
    )

    act(() => {
      result.current.adminOccupyCourt('court-1', 'Juan Pérez', '1155550000', 'free')
    })

    expect(mockSocket.emit).toHaveBeenCalledTimes(1)
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY,
      {
        courtId: 'court-1',
        playerName: 'Juan Pérez',
        phone: '1155550000',
        mode: 'free',
      },
    )
  })

  it('does not emit when socket is null', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(null, false),
    )

    act(() => {
      result.current.adminOccupyCourt('court-1', 'Juan', '1155550000', 'match')
    })

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('does not emit when not connected', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as Socket, false),
    )

    act(() => {
      result.current.adminOccupyCourt('court-1', 'Juan', '1155550000', 'free')
    })

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('passes phone as-is (encryption is caller responsibility)', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as Socket, true),
    )

    const encryptedPhone = 'abc123:def456:ghi789'
    act(() => {
      result.current.adminOccupyCourt('court-1', 'Juan', encryptedPhone, 'free')
    })

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY,
      expect.objectContaining({ phone: encryptedPhone }),
    )
  })
})
