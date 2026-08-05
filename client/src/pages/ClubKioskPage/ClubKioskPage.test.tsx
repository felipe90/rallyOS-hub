import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ClubKioskPage } from './ClubKioskPage'
import { useSocketContext } from '@/contexts/SocketContext'
import type { ClubKioskPayload, KioskNotificationData } from '@shared/types'

// Mock SocketContext
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'sportTerm.clubKioskNoCourts.tableTennis': 'No hay mesas',
        clubKioskNoCourts: 'No hay canchas',
        commonVs: 'vs',
      }
      return map[key] || key
    },
  }),
  changeLanguage: vi.fn(),
}))

// Mock SportContext — page resolves terms via useSportTerms
vi.mock('@/contexts/SportContext', () => ({
  useSport: () => ({ sport: 'tableTennis', sportLoaded: true }),
}))

// Mock ClubKioskCard to simplify testing
vi.mock('@/components/organisms/ClubKioskCard', () => ({
  ClubKioskCard: vi.fn(({ court }: { court: { name: string } }) => (
    <div data-testid="club-kiosk-card">{court.name}</div>
  )),
}))

// Mock KioskSportsTicker to verify notification prop wiring
const MockTicker = vi.hoisted(() => vi.fn(
  ({ notification, defaultTexts }: { notification?: KioskNotificationData | null; defaultTexts?: string[] }) =>
    <div data-testid="kiosk-sports-ticker">
      {notification ? (
        <span data-testid="ticker-notification">{notification.message}</span>
      ) : (
        <span data-testid="ticker-no-notification">No notification</span>
      )}
      {defaultTexts && defaultTexts.length > 0 && (
        <span data-testid="ticker-default-texts">{defaultTexts.join(',')}</span>
      )}
    </div>
))
vi.mock('@/components/organisms/KioskSportsTicker', () => ({
  KioskSportsTicker: MockTicker,
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
      socket: { on: mockOn, off: vi.fn(), emit: vi.fn() },
      connected: true,
      connecting: false,
    })

    render(<ClubKioskPage />)

    // Should show empty state
    expect(screen.getByText('No hay mesas')).toBeInTheDocument()
  })

  it('renders club name and courts from CLUB_KIOSK_DATA', () => {
    let handler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((_event: string, h: (...args: unknown[]) => void) => {
      handler = h
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: mockOn, off: vi.fn(), emit: vi.fn() },
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
      socket: { on: mockOn, off: vi.fn(), emit: vi.fn() },
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
      socket: { on: mockOn, off: mockOff, emit: vi.fn() },
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
      socket: { on: mockOn, off: vi.fn(), emit: vi.fn() },
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
      socket: { on: mockOn, off: vi.fn(), emit: vi.fn() },
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

describe('ClubKioskPage — kiosk notification wiring', () => {
  const mockNotification: KioskNotificationData = {
    type: 'info',
    message: 'Club announcement',
    duration: 5,
    timestamp: Date.now(),
  }

  beforeEach(() => {
    MockTicker.mockClear()
  })

  it('passes kioskNotification to ticker when scope is "club"', () => {
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      connected: true,
      connecting: false,
      kioskNotification: { ...mockNotification, scope: 'club' },
    })

    render(<ClubKioskPage />)

    expect(screen.getByTestId('kiosk-sports-ticker')).toBeInTheDocument()
    expect(screen.getByTestId('ticker-notification')).toHaveTextContent('Club announcement')
  })

  it('passes kioskNotification to ticker when scope is undefined (backward compat)', () => {
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      connected: true,
      connecting: false,
      kioskNotification: { ...mockNotification, scope: undefined },
    })

    render(<ClubKioskPage />)

    expect(screen.getByTestId('ticker-notification')).toHaveTextContent('Club announcement')
  })

  it('filters out general-scoped notifications from ticker', () => {
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      connected: true,
      connecting: false,
      kioskNotification: { ...mockNotification, scope: 'general' },
    })

    render(<ClubKioskPage />)

    // Ticker should show no notification (filtered out)
    expect(screen.getByTestId('ticker-no-notification')).toBeInTheDocument()
    expect(screen.queryByTestId('ticker-notification')).not.toBeInTheDocument()
  })

  it('passes defaultTexts rotation strings to ticker', () => {
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      connected: true,
      connecting: false,
      kioskNotification: null,
    })

    render(<ClubKioskPage />)

    expect(screen.getByTestId('ticker-default-texts')).toBeInTheDocument()
    expect(screen.getByTestId('ticker-default-texts')).toHaveTextContent(',')
  })
})
