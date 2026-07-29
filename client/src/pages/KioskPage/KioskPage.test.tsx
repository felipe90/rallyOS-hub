import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { KioskPage } from './KioskPage'
import { useSocketContext } from '@/contexts/SocketContext'

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
    vi.clearAllMocks()
  })

  it('shows loading spinner while waiting for mode', () => {
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<MemoryRouter><KioskPage /></MemoryRouter>)

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('renders ClubKioskPage when KIOSK_MODE is club', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<MemoryRouter><KioskPage /></MemoryRouter>)

    act(() => {
      handler({ mode: 'club' })
    })

    expect(screen.getByTestId('club-kiosk')).toBeInTheDocument()
    expect(screen.queryByTestId('tournament-kiosk')).not.toBeInTheDocument()
  })

  it('renders KioskAllCourtsPage when KIOSK_MODE is tournament', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<MemoryRouter><KioskPage /></MemoryRouter>)

    act(() => {
      handler({ mode: 'tournament' })
    })

    expect(screen.getByTestId('tournament-kiosk')).toBeInTheDocument()
    expect(screen.queryByTestId('club-kiosk')).not.toBeInTheDocument()
  })

  it('switches mode when KIOSK_MODE changes', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: vi.fn() },
    })

    render(<MemoryRouter><KioskPage /></MemoryRouter>)

    act(() => { handler({ mode: 'club' }) })
    expect(screen.getByTestId('club-kiosk')).toBeInTheDocument()

    act(() => { handler({ mode: 'tournament' }) })
    expect(screen.getByTestId('tournament-kiosk')).toBeInTheDocument()
    expect(screen.queryByTestId('club-kiosk')).not.toBeInTheDocument()
  })

  it('cleans up KIOSK_MODE listener on unmount', () => {
    const mockOff = vi.fn()
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, emit: vi.fn(), off: mockOff },
    })

    const { unmount } = render(<MemoryRouter><KioskPage /></MemoryRouter>)
    unmount()

    expect(mockOff).toHaveBeenCalledWith('KIOSK_MODE', expect.any(Function))
  })

  it('renders without crashing when socket is null', () => {
    mockUseSocketContext.mockReturnValue({
      socket: null,
    })

    expect(() => render(<MemoryRouter><KioskPage /></MemoryRouter>)).not.toThrow()
  })

  it('force mode via URL /kiosk/club shows club kiosk', () => {
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    })

    render(<MemoryRouter initialEntries={['/kiosk/club']}><KioskPage /></MemoryRouter>)

    expect(screen.getByTestId('club-kiosk')).toBeInTheDocument()
  })

  it('force mode via URL /kiosk/tournament shows tournament kiosk', () => {
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    })

    render(<MemoryRouter initialEntries={['/kiosk/tournament']}><KioskPage /></MemoryRouter>)

    expect(screen.getByTestId('tournament-kiosk')).toBeInTheDocument()
  })
})
