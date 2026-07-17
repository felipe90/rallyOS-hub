/**
 * useAuthFlow — OWNER_VERIFIED session JWT storage (REQ-12).
 *
 * Verifies that after OWNER_VERIFIED, the hook calls both
 * `setTournamentToken` (JWT for HTTP Bearer) AND `setSessionToken`
 * (same JWT persisted to sessionStorage for socket reconnect).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthFlow } from './useAuthFlow'
import { SocketEvents } from '@shared/events'

function makeMockSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  return {
    connected: true,
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      ;(listeners[event] ||= []).push(fn)
    }),
    off: vi.fn(),
    emit: vi.fn(),
    fire: (event: string, payload: unknown) => {
      listeners[event]?.forEach((fn) => fn(payload))
    },
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useAuthFlow — OWNER_VERIFIED stores the JWT as session token (REQ-12)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('calls setSessionToken with the tournamentToken JWT on OWNER_VERIFIED', () => {
    const socket = makeMockSocket()
    const setOwner = vi.fn()
    const login = vi.fn()
    const setTournamentToken = vi.fn()
    const setSessionToken = vi.fn()

    const { result } = renderHook(
      () =>
        useAuthFlow({
          socket: socket as any,
          connected: true,
          setOwner,
          login,
          setTournamentToken,
          setSessionToken,
          onOwnerResolved: vi.fn(),
        }),
      { wrapper },
    )

    result.current.submitPin('12345678')

    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.VERIFY_OWNER, {
      pin: '12345678',
    })

    // Simulate the server-emitted OWNER_VERIFIED with a 3-seg JWT
    act(() => {
      socket.fire(SocketEvents.SERVER.OWNER_VERIFIED, {
        token: 'owner-session',
        tournamentToken: 'aaa.bbb.ccc',
      })
    })

    expect(setTournamentToken).toHaveBeenCalledWith('aaa.bbb.ccc')
    expect(setSessionToken).toHaveBeenCalledWith('aaa.bbb.ccc')
  })

  it('does NOT call setSessionToken when payload carries no tournamentToken', () => {
    const socket = makeMockSocket()
    const setOwner = vi.fn()
    const login = vi.fn()
    const setTournamentToken = vi.fn()
    const setSessionToken = vi.fn()

    const { result } = renderHook(
      () =>
        useAuthFlow({
          socket: socket as any,
          connected: true,
          setOwner,
          login,
          setTournamentToken,
          setSessionToken,
          onOwnerResolved: vi.fn(),
        }),
      { wrapper },
    )

    result.current.submitPin('12345678')

    act(() => {
      socket.fire(SocketEvents.SERVER.OWNER_VERIFIED, { token: 'owner-session' })
    })

    // No JWT → setTournamentToken gets '' and setSessionToken is NOT called.
    expect(setTournamentToken).toHaveBeenCalledWith('')
    expect(setSessionToken).not.toHaveBeenCalled()
  })
})