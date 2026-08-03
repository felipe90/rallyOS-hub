/**
 * Guards on handleCourtUpdate (useSocketState):
 *  - a COURT_UPDATE for a non-current court must NOT promote it to currentCourt
 *  - consecutive identical COURT_UPDATE events must NOT force a re-render
 *  - a real change on the current court must still re-render (correctness)
 *
 * The socket is faked with an in-memory event bus so the COURT_UPDATE handler
 * can be driven directly.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useSocketState } from './useSocketState'
import { SocketEvents } from '@shared/events'
import { COURT_MODE } from '@shared/types'
import type { CourtInfo } from '@shared/types'
import type { Socket } from 'socket.io-client'

function createMockSocket() {
  const handlers = new Map<string, (data: unknown) => void>()
  return {
    socket: {
      on: (event: string, handler: (data: unknown) => void) => {
        handlers.set(event, handler)
      },
      off: (event: string) => {
        handlers.delete(event)
      },
      emit: vi.fn(),
    } as unknown as Socket,
    trigger: (event: string, data: unknown) => {
      handlers.get(event)?.(data)
    },
  }
}

function court(id: string, overrides: Partial<CourtInfo> = {}): CourtInfo {
  return {
    id,
    number: 1,
    name: `Court ${id}`,
    status: 'WAITING',
    playerCount: 0,
    mode: COURT_MODE.TOURNAMENT,
    ...overrides,
  }
}

describe('useSocketState — handleCourtUpdate guards', () => {
  it('does not promote a COURT_UPDATE for a non-current court to currentCourt', () => {
    const mock = createMockSocket()
    render(<Harness socket={mock.socket} />)

    act(() => mock.trigger(SocketEvents.SERVER.COURT_UPDATE, court('A', { currentScore: { a: 1, b: 0 } })))
    expect(screen.getByTestId('current')).toHaveTextContent('A')
    expect(screen.getByTestId('current-score')).toHaveTextContent('1')

    // A point on court B must update the courts list but leave currentCourt at A.
    act(() => mock.trigger(SocketEvents.SERVER.COURT_UPDATE, court('B', { currentScore: { a: 5, b: 3 } })))
    expect(screen.getByTestId('current')).toHaveTextContent('A')
    expect(screen.getByTestId('current-score')).toHaveTextContent('1')
    expect(screen.getByTestId('courts')).toHaveTextContent('A,B')
  })

  it('keeps state references stable for consecutive identical COURT_UPDATE events', () => {
    // React re-runs the host component once even when a setState updater bails
    // out, so a raw render counter is misleading. What actually prevents the
    // global re-render is that the state references stay IDENTICAL, which keeps
    // the memoized provider value stable and lets consumers bail out.
    const reads: Array<{ courts: CourtInfo[]; currentCourt: CourtInfo | null }> = []
    function Probe({ socket }: { socket: Socket }) {
      reads.push(useSocketState(socket))
      return null
    }

    const mock = createMockSocket()
    const update = court('A', { currentScore: { a: 2, b: 1 } })
    render(<Probe socket={mock.socket} />)

    act(() => mock.trigger(SocketEvents.SERVER.COURT_UPDATE, { ...update }))
    const afterFirst = reads[reads.length - 1]
    expect(afterFirst.currentCourt?.currentScore?.a).toBe(2)

    // Same payload again → both setters bail, keeping courts/currentCourt at
    // their previous references.
    act(() => mock.trigger(SocketEvents.SERVER.COURT_UPDATE, { ...update }))
    const afterSecond = reads[reads.length - 1]
    expect(afterSecond.courts).toBe(afterFirst.courts)
    expect(afterSecond.currentCourt).toBe(afterFirst.currentCourt)
  })

  it('still re-renders when the current court data actually changes', () => {
    let renderCount = 0
    let lastScore: number | null = null
    function Counter({ socket }: { socket: Socket }) {
      renderCount += 1
      const { currentCourt } = useSocketState(socket)
      lastScore = currentCourt?.currentScore?.a ?? null
      return null
    }

    const mock = createMockSocket()
    render(<Counter socket={mock.socket} />)

    act(() => mock.trigger(SocketEvents.SERVER.COURT_UPDATE, court('A', { currentScore: { a: 2, b: 1 } })))
    expect(lastScore).toBe(2)
    expect(renderCount).toBe(2)

    act(() => mock.trigger(SocketEvents.SERVER.COURT_UPDATE, court('A', { currentScore: { a: 3, b: 1 } })))
    expect(lastScore).toBe(3)
    expect(renderCount).toBe(3)
  })
})

function Harness({ socket }: { socket: Socket }) {
  const { courts, currentCourt } = useSocketState(socket)
  return (
    <div>
      <span data-testid="courts">{courts.map(c => c.id).join(',')}</span>
      <span data-testid="current">{currentCourt ? currentCourt.id : 'none'}</span>
      <span data-testid="current-score">{currentCourt?.currentScore?.a ?? 'none'}</span>
    </div>
  )
}