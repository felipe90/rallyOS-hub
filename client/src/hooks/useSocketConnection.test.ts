/**
 * useSocketConnection — JWT handshake (REQ-13).
 *
 * Verifies the hook passes the stored session JWT in `io({ auth: { sessionToken } })`
 * so the server reconnect middleware can restore auth state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Capture the options passed to io() so we can assert the auth payload.
const ioMock = vi.fn()
vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => {
    ioMock(...args)
    return {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn(),
      connected: false,
    }
  },
  Socket: class {},
}))

import { useSocketConnection } from './useSocketConnection'

describe('useSocketConnection — REQ-13 (session JWT in auth)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    ioMock.mockClear()
  })

  it('passes auth.sessionToken = <stored JWT> when a session token is in sessionStorage', () => {
    sessionStorage.setItem('rallyos.sessionToken', 'aaa.bbb.ccc')

    const { result } = renderHook(() => useSocketConnection('https://test.local'))
    act(() => result.current.connect())

    expect(ioMock).toHaveBeenCalledTimes(1)
    const options = ioMock.mock.calls[0][1] as any
    expect(options.auth).toBeDefined()
    expect(options.auth.sessionToken).toBe('aaa.bbb.ccc')
  })

  it('passes auth.sessionToken = undefined (no JWT) when nothing is stored', () => {
    const { result } = renderHook(() => useSocketConnection('https://test.local'))
    act(() => result.current.connect())

    expect(ioMock).toHaveBeenCalledTimes(1)
    const options = ioMock.mock.calls[0][1] as any
    expect(options.auth).toBeDefined()
    expect(options.auth.sessionToken).toBeUndefined()
  })

  it('updates the auth payload after a session token is stored then reconnect', () => {
    const { result } = renderHook(() => useSocketConnection('https://test.local'))
    act(() => result.current.connect())
    expect((ioMock.mock.calls[0][1] as any).auth.sessionToken).toBeUndefined()

    sessionStorage.setItem('rallyos.sessionToken', 'x.y.z')
    act(() => result.current.disconnect())
    ioMock.mockClear()
    act(() => result.current.connect())
    expect((ioMock.mock.calls[0][1] as any).auth.sessionToken).toBe('x.y.z')
  })
})