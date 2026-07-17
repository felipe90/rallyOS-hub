/**
 * useClubAdmin — CLUB_ADMIN_VERIFIED JWT storage (REQ-10/12).
 *
 * Verifies that the `handleVerified` handler reads the `token` from the
 * CLUB_ADMIN_VERIFIED payload and forwards it to `setSessionToken` so
 * AuthContext persists it in sessionStorage for socket reconnect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClubAdmin } from './useClubAdmin'
import { SocketEvents } from '@shared/events'

function makeMockSocket() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
  const onceHandlers: Record<string, ((...args: unknown[]) => void)[]> = {}
  return {
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      ;(handlers[event] ||= []).push(fn)
    }),
    once: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      ;(onceHandlers[event] ||= []).push(fn)
    }),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
    disconnect: vi.fn(),
    // Test driver: invoke the *once*-registered handler for an event.
    fireOnce(event: string, payload: unknown) {
      const list = onceHandlers[event] || []
      const fn = list[0]
      if (fn) fn(payload)
    },
  }
}

describe('useClubAdmin — CLUB_ADMIN_VERIFIED token storage (REQ-10/12)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('forwards the JWT from CLUB_ADMIN_VERIFIED to setSessionToken', () => {
    const socket = makeMockSocket()
    const setSessionToken = vi.fn()
    const { result } = renderHook(() =>
      useClubAdmin(socket as any, true, { setSessionToken }),
    )

    act(() => {
      result.current.verifyAdminPin('424242')
    })

    // Emit CLUB_VERIFY_ADMIN happened
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, {
      pin: '424242',
    })

    // Fire the CLUB_ADMIN_VERIFIED response with a 3-seg JWT token
    act(() => {
      socket.fireOnce(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, {
        success: true,
        token: 'header.payload.sig',
      })
    })

    expect(setSessionToken).toHaveBeenCalledWith('header.payload.sig')
    expect(result.current.isAdmin).toBe(true)
  })

  it('does NOT call setSessionToken when no token is present in payload', () => {
    const socket = makeMockSocket()
    const setSessionToken = vi.fn()
    const { result } = renderHook(() =>
      useClubAdmin(socket as any, true, { setSessionToken }),
    )

    act(() => {
      result.current.verifyAdminPin('424242')
    })
    act(() => {
      socket.fireOnce(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, { success: true })
    })

    expect(result.current.isAdmin).toBe(true)
    expect(setSessionToken).not.toHaveBeenCalled()
  })

  it('does NOT call setSessionToken when no setSessionToken option is passed (legacy)', () => {
    const socket = makeMockSocket()
    const { result } = renderHook(() => useClubAdmin(socket as any, true))

    act(() => {
      result.current.verifyAdminPin('424242')
    })
    act(() => {
      socket.fireOnce(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, {
        success: true,
        token: 'a.b.c',
      })
    })

    expect(result.current.isAdmin).toBe(true)
    // No crash, no token stored
    expect(sessionStorage.getItem('rallyos.sessionToken')).toBeNull()
  })
})