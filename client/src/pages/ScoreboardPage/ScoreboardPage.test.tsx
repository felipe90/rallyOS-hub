import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ScoreboardPage } from './ScoreboardPage'
import { useAuthContext } from '@/contexts/AuthContext'
import { useSocketContext } from '@/contexts/SocketContext'
import { usePermissions } from '@/hooks/usePermissions'

const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>
const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>
const mockUsePermissions = usePermissions as ReturnType<typeof vi.fn>

// Define role constants for tests
const ROLE_REFEREE = 'referee'
const ROLE_VIEWER = 'viewer'
const ROLE_OWNER = 'owner'

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  UserRoles: {
    OWNER: 'owner',
    REFEREE: 'referee',
    VIEWER: 'viewer',
  },
}))

vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}))

vi.mock('@/hooks/useScoreboardUrl', () => ({
  useScoreboardUrl: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// Use actual hooks from ./ (they call mockEmit from mocked useSocketContext)
// Only mock useScoreboardUrl since it manipulates window.history
vi.mock('@/hooks/useScoreboardUrl', () => ({
  useScoreboardUrl: vi.fn(),
}))

const createMockMatch = (overrides = {}) => ({
  tableId: 'table-1',
  tableName: 'Mesa 1',
  playerNames: { a: 'Juan', b: 'Pedro' },
  config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
  score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE' as const,
  winner: null,
  history: [],
  undoAvailable: true,
  ...overrides,
})

const renderWithRouter = (ui: React.ReactElement, { route = '/scoreboard/table-1' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/scoreboard/:tableId" element={ui} />
        <Route path="/dashboard/owner" element={<div>Dashboard Owner</div>} />
        <Route path="/dashboard/referee" element={<div>Dashboard Referee</div>} />
        <Route path="/dashboard/spectator" element={<div>Waiting Room</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ScoreboardPage', () => {
  const mockEmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch(),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn(),
    })

    mockUseAuthContext.mockReturnValue({
      role: ROLE_REFEREE,
      tableId: 'table-1',
      tablePin: '1234',
      isReferee: true,
      isViewer: false,
      isOwner: false,
      isAuthenticated: true,
      ownerPin: '12345',
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
      tablePin: null,
    })

    mockUsePermissions.mockReturnValue({
      scoreboard: {
        canEdit: true,
        canConfigure: true,
        canViewHistory: true,
      },
      dashboard: {
        canCreateTable: false,
        showPinColumn: false,
        showQrColumn: false,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads match data when component mounts', async () => {
    renderWithRouter(<ScoreboardPage />)

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('GET_MATCH_STATE', { tableId: 'table-1' })
    })
  })

  it('authenticates as referee when page loads in referee mode', async () => {
    mockUseAuthContext.mockReturnValue({
      role: ROLE_REFEREE,
      tableId: 'table-1',
      tablePin: '12345',
      isReferee: true,
      isViewer: false,
      isOwner: false,
      isAuthenticated: true,
      ownerPin: '12345',
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
    })

    renderWithRouter(<ScoreboardPage />)

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('SET_REF', { tableId: 'table-1', pin: '12345' })
    })
  })

  it('shows scoreboard for LIVE match', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'LIVE' }),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn(),
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getByText('Juan vs Pedro')).toBeInTheDocument()
  })

  it('shows config panel for non-LIVE match when canConfigure', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'WAITING' }),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn(),
    })

    mockUsePermissions.mockReturnValue({
      scoreboard: {
        canEdit: true,
        canConfigure: true,
        canViewHistory: true,
      },
      dashboard: {
        canCreateTable: false,
        showPinColumn: false,
        showQrColumn: false,
      },
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getAllByText('Configurar Partido').length).toBeGreaterThan(0)
  })

  it('shows scoreboard for non-LIVE match when viewer (cannot configure)', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'WAITING' }),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn(),
    })

    mockUseAuthContext.mockReturnValue({
      role: ROLE_VIEWER,
      tableId: 'table-1',
      isReferee: false,
      isViewer: true,
      isOwner: false,
      isAuthenticated: true,
      ownerPin: null,
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
      tablePin: null,
    })

    mockUsePermissions.mockReturnValue({
      scoreboard: {
        canEdit: false,
        canConfigure: false,
        canViewHistory: false,
      },
      dashboard: {
        canCreateTable: false,
        showPinColumn: false,
        showQrColumn: false,
      },
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getByText('Juan vs Pedro')).toBeInTheDocument()
  })

  it('shows loading state when no match data', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: null,
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn(),
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getByText('Cargando partido...')).toBeInTheDocument()
  })

  it('does not emit events when not connected', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'LIVE' }),
      tables: [],
      connected: false,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn(),
    })

    renderWithRouter(<ScoreboardPage />)

    expect(mockEmit).not.toHaveBeenCalled()
  })
})
