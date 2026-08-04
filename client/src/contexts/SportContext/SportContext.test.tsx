import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import { SportProvider, useSport } from './SportContext'
import { useSocketContext } from '@/contexts/SocketContext'
import { SocketEvents } from '@shared/events'

// The provider consumes useSocketContext; mock it so each test controls
// `socket` and `connected` directly. (vi.mock is hoisted above imports.)
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

/** Fake socket with registrable listeners + emit spy. */
function makeSocket() {
  const listeners: Record<string, (...args: any[]) => void> = {}
  return {
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      listeners[event] = cb
    }),
    off: vi.fn((event: string) => {
      delete listeners[event]
    }),
    emit: vi.fn(),
    connected: true,
    fire(event: string, payload: unknown) {
      listeners[event]?.(payload)
    },
  }
}

type FakeSocket = ReturnType<typeof makeSocket>

const Probe = () => {
  const { sport, sportLoaded } = useSport()
  return (
    <div>
      <span data-testid="sport">{sport}</span>
      <span data-testid="loaded">{String(sportLoaded)}</span>
    </div>
  )
}

describe('SportContext', () => {
  let socket: FakeSocket

  beforeEach(() => {
    vi.clearAllMocks()
    socket = makeSocket()
    mockUseSocketContext.mockReturnValue({ socket, connected: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits CLUB_GET_CONFIG on connect and registers the CLUB_CONFIG listener', () => {
    render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_CONFIG,
      expect.any(Function)
    )
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.CLUB_GET_CONFIG)
  })

  it('defaults to tableTennis with sportLoaded=false before config arrives (ST-1 flash)', () => {
    render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    expect(screen.getByTestId('sport')).toHaveTextContent('tableTennis')
    expect(screen.getByTestId('loaded')).toHaveTextContent('false')
  })

  it('resolves padel from CLUB_CONFIG and flips sportLoaded (ST-1 padel club)', () => {
    render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_CONFIG, { sport: 'padel' })
    })

    expect(screen.getByTestId('sport')).toHaveTextContent('padel')
    expect(screen.getByTestId('loaded')).toHaveTextContent('true')
  })

  it('resolves tableTennis from CLUB_CONFIG (configured TT club)', () => {
    render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_CONFIG, { sport: 'tableTennis' })
    })

    expect(screen.getByTestId('sport')).toHaveTextContent('tableTennis')
    expect(screen.getByTestId('loaded')).toHaveTextContent('true')
  })

  it('normalizes an unknown sport value to tableTennis (mirror ClubPlayerHandler.ts:207)', () => {
    render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_CONFIG, { sport: 'pickleball' })
    })

    expect(screen.getByTestId('sport')).toHaveTextContent('tableTennis')
    expect(screen.getByTestId('loaded')).toHaveTextContent('true')
  })

  it('keeps the TT fallback when CLUB_CONFIG carries no sport (no-club tournament)', () => {
    render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    act(() => {
      socket.fire(SocketEvents.SERVER.CLUB_CONFIG, { sport: null })
    })

    expect(screen.getByTestId('sport')).toHaveTextContent('tableTennis')
    expect(screen.getByTestId('loaded')).toHaveTextContent('false')
  })

  it('re-emits CLUB_GET_CONFIG on reconnect (D1)', () => {
    const { rerender } = render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )
    expect(socket.emit).toHaveBeenCalledTimes(1)

    mockUseSocketContext.mockReturnValue({ socket, connected: false })
    rerender(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    mockUseSocketContext.mockReturnValue({ socket, connected: true })
    rerender(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    expect(socket.emit).toHaveBeenCalledTimes(2)
  })

  it('cleans up the CLUB_CONFIG listener on unmount', () => {
    const { unmount } = render(
      <SportProvider>
        <Probe />
      </SportProvider>
    )

    unmount()

    expect(socket.off).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_CONFIG,
      expect.any(Function)
    )
  })

  it('keeps the context value referentially stable across provider re-renders (C1)', () => {
    const seen: unknown[] = []
    const StabilityProbe = () => {
      seen.push(useSport())
      const [, force] = useState(0)
      return <button data-testid="force" onClick={() => force((n) => n + 1)} />
    }

    const { rerender } = render(
      <SportProvider>
        <StabilityProbe />
      </SportProvider>
    )

    rerender(
      <SportProvider>
        <StabilityProbe />
      </SportProvider>
    )

    // Force the consumer to re-read the context; it must observe the SAME
    // value object the provider built before the unrelated re-render.
    screen.getByTestId('force').click()

    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen[0]).toBe(seen[seen.length - 1])
  })

  it('throws when useSport is used outside SportProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useSport must be used within SportProvider')
    spy.mockRestore()
  })
})
