import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderWithProviders } from '@/test/test-utils'
import { useDashboardAuth } from '@/hooks/useDashboardAuth'
import type { MatchStateExtended } from '@/shared/types'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/hooks/useDashboardAuth', () => ({
  useDashboardAuth: vi.fn(),
}))

const mockUseDashboardAuth = useDashboardAuth as ReturnType<typeof vi.fn>

const createMockMatch = (history: MatchStateExtended['history'] = []): MatchStateExtended => ({
  tableId: 'test-table',
  tableName: 'Test Table',
  playerNames: { a: 'Player A', b: 'Player B' },
  history,
  undoAvailable: false,
  config: {
    pointsPerSet: 21,
    bestOf: 3,
    minDifference: 2,
  },
  score: {
    sets: { a: 0, b: 0 },
    currentSet: { a: 0, b: 0 },
    serving: 'A',
  },
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
})

const createScoreChange = (player: 'A' | 'B', action: 'POINT' | 'CORRECTION', timestamp: number) => ({
  id: `${timestamp}`,
  player,
  action,
  pointsBefore: { a: 0, b: 0 },
  pointsAfter: action === 'POINT' ? { a: player === 'A' ? 1 : 0, b: player === 'B' ? 1 : 0 } : { a: 0, b: 0 },
  timestamp,
})

describe('HistoryViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: user is owner, so page renders normally
    mockUseDashboardAuth.mockReturnValue({
      isOwner: true,
      isReferee: false,
      canCreateTable: true,
      showPinColumn: true,
      showQrColumn: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra historial de partidos', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    const mockHistory = [
      createScoreChange('A', 'POINT', Date.now() - 30000),
      createScoreChange('B', 'POINT', Date.now() - 60000),
    ] as MatchStateExtended['history']
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch(mockHistory) } }
    )

    expect(screen.getByText('⚽ Punto - A')).toBeInTheDocument()
    expect(screen.getByText('⚽ Punto - B')).toBeInTheDocument()
  })

  it('muestra empty state cuando no hay historial', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch([]) } }
    )

    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument()
  })

  it('muestra empty state cuando currentMatch es null', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: null } }
    )

    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument()
  })

  it('navegación hacia atrás funciona - renderiza botón', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    
    renderWithProviders(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch([]) } }
    )

    const backButton = screen.getByText('Atrás')
    expect(backButton).toBeInTheDocument()
  })

  it('es accesible - tiene encabezado con título', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch([]) } }
    )

    expect(screen.getByRole('heading', { name: /historial/i })).toBeInTheDocument()
  })

  it('renderiza botón de navegación hacia atrás', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    const mockHistory = [
      createScoreChange('A', 'POINT', Date.now()),
    ] as MatchStateExtended['history']
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch(mockHistory) } }
    )

    expect(screen.getByText('Atrás')).toBeInTheDocument()
  })

  it('renderiza correctamente eventos de tipo UNDO', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    const mockHistory = [
      createScoreChange('A', 'CORRECTION', Date.now()),
    ] as MatchStateExtended['history']
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch(mockHistory) } }
    )

    expect(screen.getByText(/↩️ Deshacer/)).toBeInTheDocument()
  })

  it('redirige a non-owners', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    
    // Set user as non-owner (referee)
    mockUseDashboardAuth.mockReturnValue({
      isOwner: false,
      isReferee: true,
      canCreateTable: false,
      showPinColumn: false,
      showQrColumn: false,
    })
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch([]) } }
    )

    // Page should redirect to referee dashboard for referees
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/referee')
  })

  it('redirige spectators a spectator dashboard', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    
    // Set user as viewer (spectator)
    mockUseDashboardAuth.mockReturnValue({
      isOwner: false,
      isReferee: false,
      canCreateTable: false,
      showPinColumn: false,
      showQrColumn: false,
    })
    
    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      { mockSocketContext: { currentMatch: createMockMatch([]) } }
    )

    // Page should redirect to spectator dashboard for viewers
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/spectator')
  })
})
