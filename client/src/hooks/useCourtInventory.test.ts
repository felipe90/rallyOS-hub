/**
 * useCourtInventory tests (admin-court-inventory slice 3, INV-6).
 *
 * The hook reconciles the four wire sources into one catalog + availability
 * view (the pure logic lives in services/courts/reconcileInventory and is
 * tested separately) and exposes the INVENTORY_* + bridge club-flow action
 * emitters. Here we feed the four socket events through a mock socket and
 * assert the reconciled view + the emitted payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { AVAILABILITY, INVENTORY_STATUS } from '@shared/types'
import type { CourtRecord } from '@shared/types'
import { useCourtInventory } from './useCourtInventory'

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

const catalogRecord = (courtId: string, over: Partial<CourtRecord> = {}): CourtRecord => ({
  courtId,
  number: 1,
  name: `Mesa ${courtId}`,
  inventoryStatus: INVENTORY_STATUS.ACTIVE,
  ...over,
})

describe('useCourtInventory — reconciliation (feed 4 wire sources)', () => {
  let mockSocket: Partial<Socket> & { fireServerEvent: (e: string, ...a: unknown[]) => void }

  beforeEach(() => {
    mockSocket = createMockSocket()
    vi.clearAllMocks()
  })

  it('reconciles the INVENTORY_UPDATED catalog into ACTIVE + IDLE rows', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
    })
    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0]).toMatchObject({
      courtId: 'c1',
      inventoryStatus: INVENTORY_STATUS.ACTIVE,
      availability: AVAILABILITY.IDLE,
      inCatalog: true,
    })
  })

  it('requests the catalog snapshot via INVENTORY_LIST when connected (connect-race fix)', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_LIST)
    // The snapshot response arrives as INVENTORY_UPDATED and reconciles.
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
    })
    expect(result.current.courts).toHaveLength(1)
    expect(result.current.courts[0].courtId).toBe('c1')
  })

  it('does not request the catalog snapshot while disconnected', () => {
    renderHook(() => useCourtInventory(mockSocket as Socket, false))
    expect(mockSocket.emit).not.toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_LIST)
  })

  it('derives BUSY from a CLUB_KIOSK_DATA OCCUPIED flow on a catalog court', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Club',
        courts: [{ id: 'c1', name: 'Mesa c1', status: 'OCCUPIED', mode: 'club', playerName: 'Lucía' }],
      })
    })
    expect(result.current.courts[0].availability).toBe(AVAILABILITY.BUSY)
    expect(result.current.courts[0].playerName).toBe('Lucía')
  })

  it('derives BUSY from a COURT_LIST LIVE tournament court', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
      mockSocket.fireServerEvent(SocketEvents.SERVER.COURT_LIST, [
        { id: 'c1', number: 1, name: 'Mesa c1', status: 'LIVE', playerCount: 2 },
      ])
    })
    expect(result.current.courts[0].availability).toBe(AVAILABILITY.BUSY)
  })

  it('derives BUSY from a BRACKET_STATE binding (INV-4)', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
      mockSocket.fireServerEvent(SocketEvents.SERVER.BRACKET_STATE, {
        name: 'B1',
        numSlots: 4,
        includeThirdPlace: false,
        matches: [{ id: 'R1-M1', round: 1, position: 0, playerA: 'A', playerB: 'B', winner: null, status: 'READY', courtId: 'c1' }],
        thirdPlaceMatch: null,
        status: 'ACTIVE',
        createdAt: 0,
      })
    })
    expect(result.current.courts[0].availability).toBe(AVAILABILITY.BUSY)
  })

  it('re-reconciles when a later event clears the flow (BUSY → IDLE)', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Club',
        courts: [{ id: 'c1', name: 'Mesa c1', status: 'OCCUPIED', mode: 'club' }],
      })
    })
    expect(result.current.courts[0].availability).toBe(AVAILABILITY.BUSY)

    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Club',
        courts: [{ id: 'c1', name: 'Mesa c1', status: 'FINISHED', mode: 'club' }],
      })
    })
    expect(result.current.courts[0].availability).toBe(AVAILABILITY.IDLE)
  })
})

describe('useCourtInventory — action emitters', () => {
  let mockSocket: Partial<Socket> & { fireServerEvent: (e: string, ...a: unknown[]) => void }

  beforeEach(() => {
    mockSocket = createMockSocket()
    vi.clearAllMocks()
  })

  it('add() emits INVENTORY_ADD with the suggested name', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => result.current.add('Mesa Nueva'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_ADD, { name: 'Mesa Nueva' })
  })

  it('rename() emits INVENTORY_RENAME with courtId + name', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => result.current.rename('c1', 'Mesa Renombrada'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_RENAME, {
      courtId: 'c1',
      name: 'Mesa Renombrada',
    })
  })

  it('setMaintenance() emits INVENTORY_MAINTENANCE with the toggle', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => result.current.setMaintenance('c1', true))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_MAINTENANCE, {
      courtId: 'c1',
      maintenance: true,
    })
  })

  it('archive() emits INVENTORY_ARCHIVE with courtId', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => result.current.archive('c1'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_ARCHIVE, { courtId: 'c1' })
  })

  it('forceEnd() emits INVENTORY_FORCE_END with courtId', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => result.current.forceEnd('c1'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.INVENTORY_FORCE_END, { courtId: 'c1' })
  })

  it('bridge club-flow actions emit the legacy CLUB_* events (deleted in 5.4)', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => result.current.activate('c1'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_ACTIVATE_COURT, { courtId: 'c1' })
    act(() => result.current.deactivate('c1'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_DEACTIVATE_COURT, { courtId: 'c1' })
    act(() => result.current.reset('c1'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_RESET_COURT, { courtId: 'c1' })
    act(() => result.current.adminOccupy('c1', 'Juan', 'enc', 'free'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY, {
      courtId: 'c1',
      playerName: 'Juan',
      phone: 'enc',
      mode: 'free',
    })
  })

  it('toggleFeatured() emits SET_FEATURED with the opposite target (club-featured-courts)', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.INVENTORY_UPDATED, {
        courts: [catalogRecord('c1')],
      })
      mockSocket.fireServerEvent(SocketEvents.SERVER.CLUB_KIOSK_DATA, {
        clubName: 'Club',
        courts: [{ id: 'c1', name: 'Mesa c1', status: 'OCCUPIED', mode: 'club', featured: false }],
      })
    })
    // Not featured → feature it.
    act(() => result.current.toggleFeatured('c1'))
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.SET_FEATURED, { targetCourtId: 'c1' })
  })

  it('sets the error code from a server ERROR event', () => {
    const { result } = renderHook(() => useCourtInventory(mockSocket as Socket, true))
    act(() => {
      mockSocket.fireServerEvent(SocketEvents.SERVER.ERROR, { code: 'ARCHIVE_FAILED', message: 'x' })
    })
    expect(result.current.error).toBe('ARCHIVE_FAILED')
    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })

  it('sets NO_CONNECTION when an action is emitted without a live socket', () => {
    const { result } = renderHook(() => useCourtInventory(null, false))
    act(() => result.current.add('Mesa'))
    expect(result.current.error).toBe('NO_CONNECTION')
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })
})
