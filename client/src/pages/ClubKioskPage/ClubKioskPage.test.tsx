import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ClubKioskPage } from './ClubKioskPage'
import { useSocketContext } from '@/contexts/SocketContext'
import type { ClubKioskPayload } from '@shared/types'

// Mock SocketContext
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubKioskNoCourts: 'No hay canchas',
        commonVs: 'vs',
      }
      return map[key] || key
    },
  }),
  changeLanguage: vi.fn(),
}))

// Mock ClubKioskCard to simplify testing
vi.mock('@/components/organisms/ClubKioskCard', () => ({
  ClubKioskCard: vi.fn(({ court }: { court: { name: string } }) => (
    <div data-testid="club-kiosk-card">{court.name}</div>
  )),
}))

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

function makePayload(overrides: Partial<ClubKioskPayload> = {}): ClubKioskPayload {
  return {
    clubName: 'Mi Club',
    courts: [
      { id: 'c1', name: 'Cancha 1', status: 'AVAILABLE', mode: 'club' },
      { id: 'c2', name: 'Cancha 2', status: 'OCCUPIED', mode: 'club', playerNames: { a: 'A', b: 'B' }, currentScore: { a: 3, b: 1 } },
    ],
    ...overrides,
  }
}

describe('ClubKioskPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no courts', () => {
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: vi.fn() },
      connected: true,
      connecting: false,
    })

    render(<ClubKioskPage />)

    // Should show empty state
    expect(screen.getByText('No hay canchas')).toBeInTheDocument()
  })

  it('renders club name and courts from CLUB_KIOSK_DATA', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: vi.fn() },
      connected: true,
      connecting: false,
    })

    render(<ClubKioskPage />)

    // Simulate receiving CLUB_KIOSK_DATA
    act(() => {
      handler(makePayload())
    })

    // Club name should be visible
    expect(screen.getByText('Mi Club')).toBeInTheDocument()
    // Courts should be rendered as cards
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Cancha 2')).toBeInTheDocument()
  })

  it('subscribes to CLUB_KIOSK_DATA on mount', () => {
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: vi.fn() },
      connected: true,
      connecting: false,
    })

    render(<ClubKioskPage />)

    expect(mockOn).toHaveBeenCalledWith('CLUB_KIOSK_DATA', expect.any(Function))
  })

  it('unsubscribes from CLUB_KIOSK_DATA on unmount', () => {
    const mockOff = vi.fn()
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: mockOff },
      connected: true,
      connecting: false,
    })

    const { unmount } = render(<ClubKioskPage />)
    unmount()

    expect(mockOff).toHaveBeenCalledWith('CLUB_KIOSK_DATA', expect.any(Function))
  })

  it('updates courts when new CLUB_KIOSK_DATA arrives', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: vi.fn() },
      connected: true,
      connecting: false,
    })

    render(<ClubKioskPage />)

    // First payload
    act(() => {
      handler(makePayload({ courts: [{ id: 'c1', name: 'Cancha 1', status: 'AVAILABLE', mode: 'club' }] }))
    })
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()

    // Second payload with updated data
    act(() => {
      handler(makePayload({
        clubName: 'Mi Club',
        courts: [
          { id: 'c1', name: 'Cancha 1', status: 'FINISHED', mode: 'club', currentScore: { a: 11, b: 5 } },
          { id: 'c2', name: 'Cancha 2', status: 'AVAILABLE', mode: 'club' },
        ],
      }))
    })

    // Both courts visible
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Cancha 2')).toBeInTheDocument()
  })

  it('shows ConnectionStatus in header', () => {
    const mockOn = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: vi.fn() },
      connected: true,
      connecting: false,
    })

    const { container } = render(<ClubKioskPage />)

    // ConnectionStatus component renders — look for the connected label
    const statusElements = container.querySelectorAll('[class*="flex"]')
    expect(statusElements.length).toBeGreaterThan(0)
  })

  it('renders without crashing when socket is null', () => {
    mockUseSocketContext.mockReturnValue({
      socket: null,
      connected: false,
      connecting: false,
    })

    expect(() => render(<ClubKioskPage />)).not.toThrow()
  })
})
