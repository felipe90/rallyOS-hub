/**
 * Verifies that useSocket returns a referentially stable object so that a
 * `COURT_UPDATE` broadcast (or any other provider state change) does not
 * force every consumer to re-render through a fresh context value.
 *
 * The sub-hooks are mocked with stable return values; this isolates the
 * `useMemo` behaviour in useSocket itself.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSocket } from './useSocket'

const { mockConnection, mockState, actions, connect, disconnect } = vi.hoisted(() => ({
  mockConnection: { connected: true, connecting: false, error: null, errorCode: null },
  mockState: { courts: [] as unknown[] },
  actions: {
    emit: vi.fn(),
    createCourt: vi.fn(),
    requestCourts: vi.fn(),
    requestCourtsWithPins: vi.fn(),
    scorePoint: vi.fn(),
    undoLastPoint: vi.fn(),
    startMatch: vi.fn(),
    regeneratePin: vi.fn(),
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
}))

vi.mock('./useSocketConnection', () => ({
  useSocketConnection: () => ({
    socketRef: { current: null },
    ...mockConnection,
    connect,
    disconnect,
  }),
}))

vi.mock('./useSocketState', () => ({
  useSocketState: () => ({
    courts: mockState.courts,
    currentMatch: null,
    currentCourt: null,
    appError: null,
    allHistories: null,
    hubConfig: null,
    kioskNotification: null,
    bracket: null,
  }),
}))

vi.mock('./useSocketActions', () => ({
  useSocketActions: () => actions,
}))

describe('useSocket', () => {
  it('exports the useSocket hook', () => {
    expect(useSocket).toBeDefined()
  })

  it('returns a referentially stable object across re-renders when nothing changed', () => {
    const { result, rerender } = renderHook(() => useSocket({ autoConnect: false }))
    const first = result.current
    rerender()
    rerender()
    expect(result.current).toBe(first)
  })

  it('returns a new object when a state dependency changes', () => {
    const { result, rerender } = renderHook(() => useSocket({ autoConnect: false }))
    const first = result.current
    expect(first.courts).toHaveLength(0)

    mockState.courts = [{ id: 'court-1' }]
    rerender()

    expect(result.current).not.toBe(first)
    expect(result.current.courts).toHaveLength(1)
  })

  it('exposes the composed fields and actions', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    expect(result.current.connected).toBe(true)
    expect(typeof result.current.connect).toBe('function')
    expect(typeof result.current.disconnect).toBe('function')
    expect(typeof result.current.emit).toBe('function')
    expect(typeof result.current.scorePoint).toBe('function')
  })
})