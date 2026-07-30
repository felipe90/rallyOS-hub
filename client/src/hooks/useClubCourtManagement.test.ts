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

function createMockSocket(): Partial<Socket> & {
  fireServerEvent: (event: string, ...args: unknown[]) => void
} {
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
    fireServerEvent: (event: string, ...args: unknown[]) => {
      const h = listeners.get(event)
      if (h) h(...args)
    },
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

// ── club-featured-courts — toggleFeatured + handleKioskData featured ────────────────────

describe('useClubCourtManagement — toggleFeatured (club-featured-courts)', () => {
  let mockSocket: ReturnType<typeof createMockSocket>

  beforeEach(() => {
    mockSocket = createMockSocket()
    vi.clearAllMocks()
  })

  it('emits SET_FEATURED with targetCourtId when court is NOT featured (feature it)', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as unknown as Socket, true),
    )

    // Seed courts state via CLUB_KIOSK_DATA with featured=false
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Test Club',
        courts: [{ id: 'court-1', name: 'Mesa 1', status: 'AVAILABLE', mode: 'club', featured: false }],
      })
    })

    expect(result.current.courts[0].featured).toBe(false)

    act(() => {
      result.current.toggleFeatured('court-1')
    })

    expect(mockSocket.emit).toHaveBeenCalledTimes(1)
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.SET_FEATURED,
      { targetCourtId: 'court-1' },
    )
  })

  it('emits SET_FEATURED with targetCourtId=null when court IS already featured (unfeature it)', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as unknown as Socket, true),
    )

    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Test Club',
        courts: [{ id: 'court-1', name: 'Mesa 1', status: 'AVAILABLE', mode: 'club', featured: true }],
      })
    })

    expect(result.current.courts[0].featured).toBe(true)

    act(() => {
      result.current.toggleFeatured('court-1')
    })

    expect(mockSocket.emit).toHaveBeenCalledTimes(1)
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SocketEvents.CLIENT.SET_FEATURED,
      { targetCourtId: null },
    )
  })

  it('does not emit when socket is null', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(null, false),
    )

    act(() => {
      result.current.toggleFeatured('court-1')
    })

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('does not emit when not connected', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as unknown as Socket, false),
    )

    act(() => {
      result.current.toggleFeatured('court-1')
    })

    expect(mockSocket.emit).not.toHaveBeenCalled()
  })
})

describe('useClubCourtManagement — handleKioskData featured propagation (club-featured-courts)', () => {
  let mockSocket: ReturnType<typeof createMockSocket>

  beforeEach(() => {
    mockSocket = createMockSocket()
    vi.clearAllMocks()
  })

  it('propagates featured=true from CLUB_KIOSK_DATA into courts state', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as unknown as Socket, true),
    )

    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Test Club',
        courts: [
          { id: 'court-1', name: 'Mesa 1', status: 'AVAILABLE', mode: 'club', featured: true },
          { id: 'court-2', name: 'Mesa 2', status: 'OCCUPIED', mode: 'club', featured: false },
        ],
      })
    })

    expect(result.current.courts).toHaveLength(2)
    expect(result.current.courts[0].featured).toBe(true)
    expect(result.current.courts[1].featured).toBe(false)
  })

  it('defaults featured to false when payload omits the field (backward compat)', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as unknown as Socket, true),
    )

    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Legacy Club',
        courts: [
          // legacy payload — no `featured` field
          { id: 'court-old', name: 'Legacy Mesa', status: 'AVAILABLE', mode: 'club' },
        ],
      })
    })

    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].featured).toBe(false)
  })

  it('toggling featured after a fresh CLUB_KIOSK_DATA uses the latest court state', () => {
    const { result } = renderHook(() =>
      useClubCourtManagement(mockSocket as unknown as Socket, true),
    )

    // First broadcast: featured=false
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Test Club',
        courts: [{ id: 'court-1', name: 'Mesa 1', status: 'AVAILABLE', mode: 'club', featured: false }],
      })
    })

    act(() => {
      result.current.toggleFeatured('court-1')
    })
    expect(mockSocket.emit).toHaveBeenLastCalledWith(
      SocketEvents.CLIENT.SET_FEATURED,
      { targetCourtId: 'court-1' },
    )

    mockSocket.emit.mockClear()

    // Second broadcast flips featured to true (server authoritative)
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Test Club',
        courts: [{ id: 'court-1', name: 'Mesa 1', status: 'AVAILABLE', mode: 'club', featured: true }],
      })
    })

    act(() => {
      result.current.toggleFeatured('court-1')
    })
    expect(mockSocket.emit).toHaveBeenLastCalledWith(
      SocketEvents.CLIENT.SET_FEATURED,
      { targetCourtId: null },
    )
  })
})
