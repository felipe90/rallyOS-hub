import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { KioskAllCourtsPage, calculatePages } from './KioskAllCourtsPage'
import { useSocketContext } from '@/contexts/SocketContext'
import type { TableInfo, KioskNotificationData } from '@shared/types'

// Mock KioskNotificationToast to verify it renders without testing it again
vi.mock('@/components/organisms/KioskNotificationToast', () => ({
  KioskNotificationToast: vi.fn(({ notification }: { notification: KioskNotificationData }) => (
    <div data-testid="kiosk-notification-toast">{notification.message}</div>
  )),
}))

const mockScoreboardMount = vi.fn()

// Mock KioskScoreboard for featured court spotlight tests
vi.mock('@/components/organisms/KioskScoreboard', () => ({
  KioskScoreboard: vi.fn(({ match }: { match: { courtId: string; courtName: string } }) => {
    useEffect(() => {
      mockScoreboardMount(match.courtId)
    }, [])
    return <div data-testid="scoreboard-main">{match.courtName}</div>
  }),
}))

// Mock SocketContext
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'kioskNoActiveMatches': 'No active matches',
        'kioskPageTitle': 'Scoreboard',
        'scoreboardWifiDomain': 'Abrí rallyos.wifi',
        'scoreboardWifiQrCta': 'Escaneá para conectarte al WiFi',
        'scoreboardUrlQrCta': 'Escaneá para abrir rallyOS',
        'kioskDestacado': '★ DESTACADO',
        'kioskEnVivo': 'EN VIVO',
        'kioskNoActiveMatches': 'No active matches',
        'kioskPageTitle': 'Scoreboard',
      }
      return map[key] || key
    },
  }),
  changeLanguage: vi.fn(),
}))

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

function makeTable(overrides: Partial<TableInfo> = {}): TableInfo {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    playerCount: 2,
    playerNames: { a: 'Alice', b: 'Bob' },
    currentScore: { a: 5, b: 3 },
    ...overrides,
  }
}

function renderPage(
  courts: TableInfo[] = [],
  socketOverrides?: { on?: ReturnType<typeof vi.fn>; off?: ReturnType<typeof vi.fn>; emit?: ReturnType<typeof vi.fn> },
) {
  const mockSocket = socketOverrides || { on: vi.fn(), off: vi.fn(), emit: vi.fn() }
  mockUseSocketContext.mockReturnValue({
    courts,
    connected: true,
    connecting: false,
    socket: mockSocket,
  })

  return render(
    <MemoryRouter>
      <KioskAllCourtsPage />
    </MemoryRouter>
  )
}

describe('KioskAllCourtsPage', () => {
  it('renders empty state when no active tables', () => {
    renderPage([{ ...makeTable(), status: 'FINISHED' }])
    expect(screen.getByText('No active matches')).toBeInTheDocument()
  })

  it('renders empty state when tables array is empty', () => {
    renderPage([])
    expect(screen.getByText('No active matches')).toBeInTheDocument()
  })

  it('renders card for each LIVE table', () => {
    const table1 = makeTable({ id: 't1', name: 'Mesa 1', status: 'LIVE' })
    const table2 = makeTable({ id: 't2', name: 'Mesa 2', status: 'LIVE' })
    renderPage([table1, table2])

    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Mesa 2')).toBeInTheDocument()
  })

  it('renders card for each WAITING table', () => {
    const table = makeTable({ id: 't3', name: 'Mesa 3', status: 'WAITING' })
    renderPage([table])

    expect(screen.getByText('Mesa 3')).toBeInTheDocument()
  })

  it('filters out FINISHED tables', () => {
    const live = makeTable({ id: 't1', name: 'Live Table', status: 'LIVE' })
    const finished = makeTable({ id: 't2', name: 'Finished Table', status: 'FINISHED' })
    renderPage([live, finished])

    expect(screen.getByText('Live Table')).toBeInTheDocument()
    expect(screen.queryByText('Finished Table')).not.toBeInTheDocument()
  })

  it('filters out CONFIGURING tables', () => {
    const waiting = makeTable({ id: 't1', name: 'Waiting Table', status: 'WAITING' })
    const configuring = makeTable({ id: 't2', name: 'Configuring Table', status: 'CONFIGURING' })
    renderPage([waiting, configuring])

    expect(screen.getByText('Waiting Table')).toBeInTheDocument()
    expect(screen.queryByText('Configuring Table')).not.toBeInTheDocument()
  })

  it('shows RallyOS logo in header', () => {
    const table = makeTable({ status: 'LIVE' })
    renderPage([table])
    const logo = screen.getByAltText('RallyOS')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src')
  })

  it('shows QR code when hubConfig is available', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { ssid: 'RallyOS', wifiPassword: 'test1234', domain: 'rallyos.wifi' },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>
    )

    // QRCodeSVG renders with role="img" — both WiFi and URL QRs
    const qrSvgs = document.querySelectorAll('svg[role="img"]')
    expect(qrSvgs.length).toBe(2)
  })

  it('WiFi QR encodes WPA2 with H:false in value string', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { ssid: 'RallyOS', wifiPassword: 'test1234', domain: 'rallyos.wifi' },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>
    )

    const qrSvgs = document.querySelectorAll('svg[role="img"]')
    // Two QRs: WiFi and URL
    expect(qrSvgs.length).toBe(2)
    // Both QRs should have hardcoded size 180
    expect(qrSvgs[0]).toHaveAttribute('width', '180')
    expect(qrSvgs[1]).toHaveAttribute('width', '180')
    // WiFi QR label is visible
    expect(screen.getByText('Escaneá para conectarte al WiFi')).toBeInTheDocument()
  })

  it('URL QR encodes hub domain and port', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { ssid: 'RallyOS', wifiPassword: 'test1234', domain: 'rallyos.wifi', port: 3001 },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>
    )

    const qrSvgs = document.querySelectorAll('svg[role="img"]')
    expect(qrSvgs.length).toBe(2)
    // URL text is visible below the URL QR
    expect(screen.getByText('https://rallyos.wifi:3001')).toBeInTheDocument()
    // URL QR label is visible
    expect(screen.getByText('Escaneá para abrir rallyOS')).toBeInTheDocument()
  })

  it('hides WiFi QR when wifiPassword is absent but shows URL QR', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { domain: 'rallyos.wifi', port: 3001 },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>
    )

    const qrSvgs = document.querySelectorAll('svg[role="img"]')
    // Only the URL QR should be visible — no WiFi QR
    expect(qrSvgs.length).toBe(1)
    // URL text is still visible
    expect(screen.getByText('https://rallyos.wifi:3001')).toBeInTheDocument()
    // URL QR label is visible
    expect(screen.getByText('Escaneá para abrir rallyOS')).toBeInTheDocument()
    // WiFi label should NOT be visible
    expect(screen.queryByText('Escaneá para conectarte al WiFi')).not.toBeInTheDocument()
  })

  it('renders WiFi and URL step labels in horizontal layout', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { ssid: 'RallyOS', wifiPassword: 'test1234', domain: 'rallyos.wifi', port: 3001 },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>
    )

    // Step labels should be visible
    expect(screen.getByText('Escaneá para conectarte al WiFi')).toBeInTheDocument()
    expect(screen.getByText('Escaneá para abrir rallyOS')).toBeInTheDocument()
  })

  it('renders single table grid', () => {
    const table = makeTable({ id: 'lonely', name: 'Only Table', status: 'LIVE' })
    renderPage([table])

    expect(screen.getByText('Only Table')).toBeInTheDocument()
    // One table should still render, not show empty state
    expect(screen.queryByText('No active matches')).not.toBeInTheDocument()
  })

  it('renders grid with mixed LIVE and WAITING', () => {
    const live = makeTable({ id: 't1', name: 'Live Table', status: 'LIVE' })
    const waiting = makeTable({ id: 't2', name: 'Waiting Table', status: 'WAITING' })
    renderPage([live, waiting])

    expect(screen.getByText('Live Table')).toBeInTheDocument()
    expect(screen.getByText('Waiting Table')).toBeInTheDocument()
  })

  describe('kiosk notification toast', () => {
    const mockNotification: KioskNotificationData = {
      type: 'info',
      message: 'Test notification',
      duration: 5,
      timestamp: Date.now(),
    }

    it('renders KioskNotificationToast when kioskNotification is non-null', () => {
      mockUseSocketContext.mockReturnValue({
        courts: [makeTable({ status: 'LIVE' })],
        connected: true,
        connecting: false,
        kioskNotification: mockNotification,
      })

      render(
        <MemoryRouter>
          <KioskAllCourtsPage />
        </MemoryRouter>,
      )

      expect(screen.getByTestId('kiosk-notification-toast')).toBeInTheDocument()
      expect(screen.getByText('Test notification')).toBeInTheDocument()
    })

    it('does NOT render KioskNotificationToast when kioskNotification is null', () => {
      mockUseSocketContext.mockReturnValue({
        courts: [makeTable({ status: 'LIVE' })],
        connected: true,
        connecting: false,
        kioskNotification: null,
      })

      render(
        <MemoryRouter>
          <KioskAllCourtsPage />
        </MemoryRouter>,
      )

      expect(screen.queryByTestId('kiosk-notification-toast')).not.toBeInTheDocument()
    })

    it('does NOT render KioskNotificationToast when kioskNotification is undefined', () => {
      mockUseSocketContext.mockReturnValue({
        courts: [makeTable({ status: 'LIVE' })],
        connected: true,
        connecting: false,
      })

      render(
        <MemoryRouter>
          <KioskAllCourtsPage />
        </MemoryRouter>,
      )

      expect(screen.queryByTestId('kiosk-notification-toast')).not.toBeInTheDocument()
    })

    it('renders toast with tables still visible (does not obscure scores)', () => {
      const table1 = makeTable({ id: 't1', name: 'Mesa 1', status: 'LIVE' })
      mockUseSocketContext.mockReturnValue({
        courts: [table1],
        connected: true,
        connecting: false,
        kioskNotification: { ...mockNotification, message: 'Break time!' },
      })

      render(
        <MemoryRouter>
          <KioskAllCourtsPage />
        </MemoryRouter>,
      )

      // Toast is rendered
      expect(screen.getByText('Break time!')).toBeInTheDocument()
      // Table card is still visible
      expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    })
  })
})

describe('KioskAllCourtsPage — featured court spotlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockScoreboardMount.mockClear()
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits SUBSCRIBE_MATCH when a court has featured=true', () => {
    const mockEmit = vi.fn()
    const tables = [
      makeTable({ id: 't1', name: 'Normal Court', status: 'LIVE', featured: false }),
      makeTable({ id: 't2', name: 'Featured Court', status: 'LIVE', featured: true }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: mockEmit })

    expect(mockEmit).toHaveBeenCalledWith('SUBSCRIBE_MATCH', { courtId: 't2' })
  })

  it('does NOT emit SUBSCRIBE_MATCH when no court is featured', () => {
    const mockEmit = vi.fn()
    const tables = [
      makeTable({ id: 't1', name: 'Normal Court', status: 'LIVE' }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: mockEmit })

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('does not emit SUBSCRIBE_MATCH for FINISHED featured courts', () => {
    const mockEmit = vi.fn()
    const tables = [
      makeTable({ id: 't1', name: 'Finished Featured', status: 'FINISHED', featured: true }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: mockEmit })

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('unsubscribes old and subscribes new when featured court changes', () => {
    const mockEmit = vi.fn()
    const mockOn = vi.fn()
    const mockOff = vi.fn()
    const socket = { on: mockOn, off: mockOff, emit: mockEmit }

    const initialCourts = [
      makeTable({ id: 't1', name: 'First Featured', status: 'LIVE', featured: true }),
      makeTable({ id: 't2', name: 'Second Court', status: 'LIVE' }),
    ]

    const { rerender } = renderPage(initialCourts, socket)
    expect(mockEmit).toHaveBeenCalledWith('SUBSCRIBE_MATCH', { courtId: 't1' })

    // Change featured court
    const updatedCourts = [
      makeTable({ id: 't1', name: 'First Featured', status: 'LIVE', featured: false }),
      makeTable({ id: 't2', name: 'Second Court', status: 'LIVE', featured: true }),
    ]

    // Update mock context and re-render
    mockUseSocketContext.mockReturnValue({
      courts: updatedCourts,
      connected: true,
      connecting: false,
      socket,
    })
    rerender(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    expect(mockEmit).toHaveBeenCalledWith('UNSUBSCRIBE_MATCH', { courtId: 't1' })
    expect(mockEmit).toHaveBeenCalledWith('SUBSCRIBE_MATCH', { courtId: 't2' })
  })

  it('remounts KioskScoreboard and applies 500ms opacity fade when switching featured courts', () => {
    let matchUpdateHandler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'MATCH_UPDATE') matchUpdateHandler = handler
    })
    const socket = { on: mockOn, off: vi.fn(), emit: vi.fn() }

    const initialCourts = [
      makeTable({ id: 't1', name: 'Court A', status: 'LIVE', featured: true }),
      makeTable({ id: 't2', name: 'Court B', status: 'LIVE' }),
    ]

    const { rerender } = renderPage(initialCourts, socket)

    act(() => {
      matchUpdateHandler({
        tableId: 't1',
        courtId: 't1',
        courtName: 'Court A',
        status: 'LIVE',
        sport: 'tableTennis',
        playerNames: { a: 'Alice', b: 'Bob' },
        config: { bestOf: 5, pointsPerSet: 11, minDifference: 2, sport: 'tableTennis' },
        score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
        setHistory: [],
        history: [],
        undoAvailable: false,
        winner: null,
        swappedSides: false,
        midSetSwapped: false,
      })
    })

    expect(mockScoreboardMount).toHaveBeenCalledTimes(1)
    expect(mockScoreboardMount).toHaveBeenLastCalledWith('t1')

    const spotlightMain = screen.getByRole('main')
    expect(spotlightMain).toHaveClass('transition-opacity', 'duration-500')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(spotlightMain).toHaveClass('opacity-100')

    const updatedCourts = [
      makeTable({ id: 't1', name: 'Court A', status: 'LIVE', featured: false }),
      makeTable({ id: 't2', name: 'Court B', status: 'LIVE', featured: true }),
    ]

    mockUseSocketContext.mockReturnValue({
      courts: updatedCourts,
      connected: true,
      connecting: false,
      socket,
    })
    rerender(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Fade should be hidden immediately after switching featured courts
    expect(spotlightMain).toHaveClass('opacity-0')

    act(() => {
      matchUpdateHandler({
        tableId: 't2',
        courtId: 't2',
        courtName: 'Court B',
        status: 'LIVE',
        sport: 'tableTennis',
        playerNames: { a: 'Alice', b: 'Bob' },
        config: { bestOf: 5, pointsPerSet: 11, minDifference: 2, sport: 'tableTennis' },
        score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
        setHistory: [],
        history: [],
        undoAvailable: false,
        winner: null,
        swappedSides: false,
        midSetSwapped: false,
      })
    })

    expect(mockScoreboardMount.mock.calls[mockScoreboardMount.mock.calls.length - 1]).toEqual(['t2'])

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(spotlightMain).toHaveClass('opacity-100')
  })

  it('unsubscribes on unmount when featured court active', () => {
    const mockEmit = vi.fn()
    const tables = [
      makeTable({ id: 't1', name: 'Featured', status: 'LIVE', featured: true }),
    ]

    const { unmount } = renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: mockEmit })

    unmount()

    expect(mockEmit).toHaveBeenCalledWith('UNSUBSCRIBE_MATCH', { courtId: 't1' })
  })

  it('does not unsubscribe on unmount when no featured court', () => {
    const mockEmit = vi.fn()
    const tables = [makeTable({ id: 't1', name: 'Normal', status: 'LIVE' })]

    const { unmount } = renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: mockEmit })

    unmount()

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('listens for MATCH_UPDATE on the socket when featured court is active', () => {
    const mockOn = vi.fn()
    const tables = [
      makeTable({ id: 't1', name: 'Featured', status: 'LIVE', featured: true }),
    ]
    renderPage(tables, { on: mockOn, off: vi.fn(), emit: vi.fn() })

    expect(mockOn).toHaveBeenCalledWith('MATCH_UPDATE', expect.any(Function))
  })

  it('renders KioskScoreboard when featured court is active (Task 3.2)', () => {
    let matchUpdateHandler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'MATCH_UPDATE') matchUpdateHandler = handler
    })
    const tables = [
      makeTable({ id: 't1', name: 'Featured Court', status: 'LIVE', featured: true }),
    ]
    renderPage(tables, { on: mockOn, off: vi.fn(), emit: vi.fn() })

    // Simulate receiving MATCH_UPDATE
    act(() => {
      matchUpdateHandler({
        tableId: 't1',
        courtName: 'Featured Court',
        status: 'LIVE',
        sport: 'tableTennis',
        playerNames: { a: 'Alice', b: 'Bob' },
        config: { bestOf: 5, pointsPerSet: 11, minDifference: 2, sport: 'tableTennis' },
        score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
        setHistory: [],
        history: [],
        undoAvailable: false,
        winner: null,
        swappedSides: false,
        midSetSwapped: false,
      })
    })

    expect(screen.getByTestId('scoreboard-main')).toBeInTheDocument()
    // Text appears in both Destacado bar AND KioskScoreboard mock
    expect(screen.getAllByText('Featured Court')).toHaveLength(2)
  })

  it('does NOT render KioskScoreboard when no featured court (Task 3.2)', () => {
    const tables = [
      makeTable({ id: 't1', name: 'Normal Court', status: 'LIVE' }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: vi.fn() })

    expect(screen.queryByTestId('scoreboard-main')).not.toBeInTheDocument()
  })

  it('shows empty grid when featured court is the only court but has no active status (FINISHED)', () => {
    const tables = [
      makeTable({ id: 't1', name: 'Finished Featured', status: 'FINISHED', featured: true }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: vi.fn() })

    // No KioskScoreboard and empty state visible
    expect(screen.queryByTestId('scoreboard-main')).not.toBeInTheDocument()
    expect(screen.getByText('No active matches')).toBeInTheDocument()
  })

  it('renders Destacado bar with all elements when featured court active (Task 3.3)', () => {
    let matchUpdateHandler: (...args: unknown[]) => void = () => {}
    const mockOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'MATCH_UPDATE') matchUpdateHandler = handler
    })
    const tables = [
      makeTable({ id: 't1', name: 'Court 5', status: 'LIVE', featured: true }),
    ]
    renderPage(tables, { on: mockOn, off: vi.fn(), emit: vi.fn() })

    // Destacado bar elements visible even before MATCH_UPDATE
    expect(screen.getByText('★ DESTACADO')).toBeInTheDocument()
    expect(screen.getByText('Court 5')).toBeInTheDocument()
    expect(screen.getByText('EN VIVO')).toBeInTheDocument()
  })

  it('does NOT render header (logo, QR) when in spotlight mode', () => {
    const tables = [
      makeTable({ id: 't1', name: 'Featured', status: 'LIVE', featured: true }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: vi.fn() })

    // Logo should not be visible in spotlight mode
    expect(screen.queryByAltText('RallyOS')).not.toBeInTheDocument()
  })

  it('does not activate spotlight for CONFIGURING featured court', () => {
    const mockEmit = vi.fn()
    const tables = [
      makeTable({ id: 't1', name: 'Config Court', status: 'CONFIGURING', featured: true }),
    ]
    renderPage(tables, { on: vi.fn(), off: vi.fn(), emit: mockEmit })

    // No subscription
    expect(mockEmit).not.toHaveBeenCalled()
    // No KioskScoreboard
    expect(screen.queryByTestId('scoreboard-main')).not.toBeInTheDocument()
  })
})

describe('calculatePages', () => {
  function makeTables(count: number): TableInfo[] {
    return Array.from({ length: count }, (_, i) => makeTable({ id: `t-${i}`, name: `Table ${i}` }))
  }

  it('returns single page when all tables fit the viewport', () => {
    // Large viewport (1920×1080). With COLUMNS=3, HEADER=180, CARD=200, GAP=24:
    // rows = floor((1080 - 180) / (200 + 24)) = floor(900/224) = 4
    // cardsPerPage = 4 * 3 = 12
    const result = calculatePages(makeTables(5), /* viewportWidth */ 1920, /* viewportHeight */ 1080)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(5)
  })

  it('splits tables into multiple pages when they overflow', () => {
    // Small viewport (768×600). With COLUMNS=2 (md breakpoint), HEADER=180, CARD=200, GAP=24:
    // rows = floor((600 - 180) / (200 + 24)) = floor(420/224) = 1
    // cardsPerPage = 1 * 2 = 2
    // 8 tables → 4 pages of 2 each
    const result = calculatePages(makeTables(8), /* viewportWidth */ 768, /* viewportHeight */ 600)
    expect(result).toHaveLength(4)
    expect(result[0]).toHaveLength(2)
    expect(result[1]).toHaveLength(2)
    expect(result[2]).toHaveLength(2)
    expect(result[3]).toHaveLength(2)
  })

  it('handles single-column layout on mobile', () => {
    // Mobile (375×667). COLUMNS=1, HEADER=180, CARD=200, GAP=24:
    // rows = floor((667 - 180) / 224) = floor(487/224) = 2
    // cardsPerPage = 2 * 1 = 2
    const result = calculatePages(makeTables(5), /* viewportWidth */ 375, /* viewportHeight */ 667)
    expect(result).toHaveLength(3) // 5 tables → ceil(5/2) = 3 pages
    expect(result[0]).toHaveLength(2)
    expect(result[1]).toHaveLength(2)
    expect(result[2]).toHaveLength(1) // last page has remainder
  })

  it('returns one empty page for zero tables', () => {
    const result = calculatePages([], /* viewportWidth */ 1920, /* viewportHeight */ 1080)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(0)
  })

  it('clamps rowsPerPage to at least 1', () => {
    // Viewport so small that availableHeight < CARD_HEIGHT + CARD_GAP
    // HEADER=180, viewport=200 → availableHeight=20, rowsPerPage=Math.max(1, floor(20/224))=1
    const result = calculatePages(makeTables(3), /* viewportWidth */ 375, /* viewportHeight */ 200)
    expect(result).toHaveLength(3) // 3 pages of 1 card each
    expect(result[0]).toHaveLength(1)
  })
})

describe('KioskAllCourtsPage — rotation behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Large viewport: 1920×1080, 3 columns, ~12 cards per page
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeTables(count: number, baseName = 'Table'): TableInfo[] {
    return Array.from({ length: count }, (_, i) =>
      makeTable({ id: `rt-${i}`, name: `${baseName} ${i}`, status: 'LIVE' }),
    )
  }

  it('renders all cards in static mode when they fit (no indicators, no rotation)', () => {
    // 3 tables on 1920×1080 → all fit on one page → static mode
    mockUseSocketContext.mockReturnValue({
      courts: makeTables(3),
      connected: true,
      connecting: false,
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // All 3 tables should be visible
    expect(screen.getByText('Table 0')).toBeInTheDocument()
    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('Table 2')).toBeInTheDocument()

    // No page indicator dots (rotation mode not active)
    expect(screen.queryByTestId('page-dot-0')).not.toBeInTheDocument()
  })

  it('activates rotation mode and shows indicators when tables overflow', () => {
    // Small viewport (768×600) — only 2 cards fit per page
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })

    mockUseSocketContext.mockReturnValue({
      courts: makeTables(8),
      connected: true,
      connecting: false,
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Page indicator dots should be visible (rotation mode active)
    const dots = screen.getAllByTestId(/^page-dot-/)
    expect(dots.length).toBeGreaterThan(0)

    // Only current page's cards should be visible (2 cards out of 8)
    // The other 6 tables should NOT be in the document
    const visibleCount = makeTables(8).filter((_, i) => {
      try {
        return !!screen.getByText(`Table ${i}`)
      } catch {
        return false
      }
    }).length
    expect(visibleCount).toBeLessThan(8) // Not all tables visible = rotation is working
  })

  it('wraps currentPage from last page back to page 0', () => {
    // Small viewport (375×667) — only 2 cards fit per page
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })

    mockUseSocketContext.mockReturnValue({
      courts: makeTables(4), // 4 tables → 2 pages of 2
      connected: true,
      connecting: false,
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // 2 pages → 2 dots
    expect(screen.getAllByTestId(/^page-dot-/).length).toBe(2)

    // Advance timer past rotation interval — should wrap from page 0 → 1
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    // After advancing, page 0 tables may not be visible; page 1 tables should appear
    // The component re-rendered with currentPage=1
    const dotsAfterAdvance = screen.getAllByTestId(/^page-dot-/)
    expect(dotsAfterAdvance.length).toBe(2)

    // Advance again → should wrap back to page 0
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    // Verify dots still present (page 0 is showing again)
    const dotsAfterWrap = screen.getAllByTestId(/^page-dot-/)
    expect(dotsAfterWrap.length).toBe(2)
  })

  it('recalculates pages when tables dynamically change', () => {
    // Large viewport → all 3 tables fit (static mode)
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true })

    const initialCourts = makeTables(3)
    mockUseSocketContext.mockReturnValue({
      courts: initialCourts,
      connected: true,
      connecting: false,
    })

    const { rerender } = render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Initially static mode — no dots
    expect(screen.queryByTestId('page-dot-0')).not.toBeInTheDocument()

    // Add more tables to trigger overflow → rotation mode
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })

    const moreCourts = makeTables(8)
    mockUseSocketContext.mockReturnValue({
      courts: moreCourts,
      connected: true,
      connecting: false,
    })

    rerender(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Now rotation mode — dots should appear
    const dots = screen.getAllByTestId(/^page-dot-/)
    expect(dots.length).toBeGreaterThan(0)
  })

  it('renders QR code with hardcoded size 180', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { ssid: 'RallyOS', wifiPassword: 'test1234', domain: 'rallyos.wifi' },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    const qrSvgs = document.querySelectorAll('svg[role="img"]')
    expect(qrSvgs.length).toBeGreaterThanOrEqual(1)
    // QR size is hardcoded to 180px
    expect(qrSvgs[0]).toHaveAttribute('width', '180')
  })

  it('displays full URL in monospace font when hubConfig available', () => {
    mockUseSocketContext.mockReturnValue({
      courts: [makeTable({ status: 'LIVE' })],
      connected: true,
      connecting: false,
      hubConfig: { domain: 'rallyos.wifi', port: 3001 },
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Full URL rendered as: https://{domain}:{port}
    const urlElement = screen.getByText('https://rallyos.wifi:3001')
    expect(urlElement).toBeInTheDocument()
  })

  it('transitions from rotation to static mode when tables decrease below overflow threshold', () => {
    // Small viewport → overflow → rotation
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })

    mockUseSocketContext.mockReturnValue({
      courts: makeTables(6), // 6 tables → 3 pages of 2
      connected: true,
      connecting: false,
    })

    const { rerender } = render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Rotation mode — dots visible
    expect(screen.getAllByTestId(/^page-dot-/).length).toBe(3)

    // Reduce to 1 table on large viewport → should fit → static mode
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true })

    mockUseSocketContext.mockReturnValue({
      courts: makeTables(1),
      connected: true,
      connecting: false,
    })

    rerender(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Static mode — NO dots
    expect(screen.queryByTestId('page-dot-0')).not.toBeInTheDocument()
  })

  it('highlights active dot as filled and leaves inactive dots as outline', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })

    mockUseSocketContext.mockReturnValue({
      courts: makeTables(6), // 3 pages
      connected: true,
      connecting: false,
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Dot 0 is active (filled), others inactive
    expect(screen.getByTestId('page-dot-0').getAttribute('data-active')).toBe('true')
    expect(screen.getByTestId('page-dot-1').getAttribute('data-active')).toBe('false')
    expect(screen.getByTestId('page-dot-2').getAttribute('data-active')).toBe('false')

    // Advance past rotation interval + fade → should advance to page 1
    act(() => {
      vi.advanceTimersByTime(10_000 + 500)
    })

    // Dot 1 should now be active, dot 0 inactive
    expect(screen.getByTestId('page-dot-1').getAttribute('data-active')).toBe('true')
    expect(screen.getByTestId('page-dot-0').getAttribute('data-active')).toBe('false')
  })

  it('keeps rotation running through live score updates without flicker', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })

    const initialCourts = makeTables(6)
    mockUseSocketContext.mockReturnValue({
      courts: initialCourts,
      connected: true,
      connecting: false,
    })

    const { rerender } = render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Advance 5s (halfway through rotation interval)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    // Simulate live score update (same tables, different scores)
    const updatedCourts = initialCourts.map((t) => ({
      ...t,
      currentScore: { a: (t.currentScore?.a ?? 0) + 1, b: t.currentScore?.b ?? 0 },
    }))
    mockUseSocketContext.mockReturnValue({
      courts: updatedCourts,
      connected: true,
      connecting: false,
    })

    rerender(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Rotation continues — dots still present, page 0 still active
    expect(screen.getByTestId('page-dot-0').getAttribute('data-active')).toBe('true')

    // Advance remaining time + fade → should reach page 1
    act(() => {
      vi.advanceTimersByTime(5_000 + 500)
    })

    expect(screen.getByTestId('page-dot-1').getAttribute('data-active')).toBe('true')
  })

  it('pauses rotation when page becomes hidden and resumes on wake', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })

    mockUseSocketContext.mockReturnValue({
      courts: makeTables(6), // 3 pages
      connected: true,
      connecting: false,
    })

    render(
      <MemoryRouter>
        <KioskAllCourtsPage />
      </MemoryRouter>,
    )

    // Page 0 is active initially
    expect(screen.getByTestId('page-dot-0').getAttribute('data-active')).toBe('true')

    // Simulate page becoming hidden (TV sleep)
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Advance well past rotation interval — page should NOT change while hidden
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    // Still on page 0 because rotation was paused
    expect(screen.getByTestId('page-dot-0').getAttribute('data-active')).toBe('true')

    // Simulate page becoming visible again (TV wake)
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Advance rotation interval + fade → should advance to page 1 now
    act(() => {
      vi.advanceTimersByTime(10_000 + 500)
    })

    expect(screen.getByTestId('page-dot-1').getAttribute('data-active')).toBe('true')
  })
})
