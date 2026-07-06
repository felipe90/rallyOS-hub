import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { KioskPage } from './KioskPage'
import { useSocketContext } from '@/contexts/SocketContext'
import type { ClubConfig } from '@shared/types'

// Mock SocketContext
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock child pages
vi.mock('@/pages/KioskAllCourtsPage', () => ({
  KioskAllCourtsPage: vi.fn(() => <div data-testid="tournament-kiosk">Tournament Kiosk</div>),
}))

vi.mock('@/pages/ClubKioskPage', () => ({
  ClubKioskPage: vi.fn(() => <div data-testid="club-kiosk">Club Kiosk</div>),
}))

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

describe('KioskPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows loading spinner while detecting mode', () => {
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<KioskPage />)

    // Should show spinner in loading state
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('emits CLUB_GET_CONFIG on mount', () => {
    const mockEmit = vi.fn()
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: mockEmit, off: vi.fn() },
    })

    render(<KioskPage />)

    expect(mockEmit).toHaveBeenCalledWith('CLUB_GET_CONFIG')
  })

  it('renders ClubKioskPage when CLUB_CONFIG returns configured=true', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<KioskPage />)

    act(() => {
      handler({ configured: true, clubName: 'Mi Club', sport: 'tableTennis', adminPinHash: '', adminPin: '', createdAt: 0 } satisfies ClubConfig)
    })

    expect(screen.getByTestId('club-kiosk')).toBeInTheDocument()
    expect(screen.queryByTestId('tournament-kiosk')).not.toBeInTheDocument()
  })

  it('renders KioskAllCourtsPage when CLUB_CONFIG returns configured=false', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<KioskPage />)

    act(() => {
      handler({ configured: false, clubName: '', sport: '', adminPinHash: '', adminPin: '', createdAt: 0 } satisfies ClubConfig)
    })

    expect(screen.getByTestId('tournament-kiosk')).toBeInTheDocument()
    expect(screen.queryByTestId('club-kiosk')).not.toBeInTheDocument()
  })

  it('falls back to tournament kiosk after timeout when no CLUB_CONFIG arrives', () => {
    const mockOn = vi.fn()
    const mockOff = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: mockOff },
    })

    render(<KioskPage />)

    // Before timeout, should be loading
    expect(screen.getByText('Cargando...')).toBeInTheDocument()

    // Advance past the 5s timeout
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Should fallback to tournament kiosk
    expect(screen.getByTestId('tournament-kiosk')).toBeInTheDocument()
  })

  it('cleans up socket listener on unmount', () => {
    const mockOff = vi.fn()
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: mockOff },
    })

    const { unmount } = render(<KioskPage />)
    unmount()

    expect(mockOff).toHaveBeenCalledWith('CLUB_CONFIG', expect.any(Function))
  })

  it('renders without crashing when socket is null', () => {
    mockUseSocketContext.mockReturnValue({
      socket: null,
    })

    expect(() => render(<KioskPage />)).not.toThrow()
  })
})
