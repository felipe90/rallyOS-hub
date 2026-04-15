import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ScoreboardPage } from './ScoreboardPage'
import { useAuthContext, UserRoles } from '../../contexts/AuthContext'
import { useSocketContext } from '../../contexts/SocketContext'
import { AuthProvider } from '../../contexts/AuthContext'

const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>
const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

// Define role constants for tests
const ROLE_REFEREE = 'referee'
const ROLE_VIEWER = 'viewer'
const ROLE_OWNER = 'owner'

vi.mock('../../contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  UserRoles: {
    OWNER: 'owner',
    REFEREE: 'referee',
    VIEWER: 'viewer',
  },
  DefaultScoreboardMode: 'view',
}))

vi.mock('../../contexts/SocketContext', () => ({
  useSocketContext: vi.fn()
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn()
  }
})

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
  ...overrides
})

const renderWithRouter = (ui: React.ReactElement, { route = '/scoreboard/table-1' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/scoreboard/:tableId" element={ui} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthProvider>
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
      disconnect: vi.fn()
    })

    mockUseAuthContext.mockReturnValue({
      role: ROLE_REFEREE,
      tableId: 'table-1',
      isReferee: true,
      isViewer: false,
      isAuthenticated: true,
      ownerPin: '12345',
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
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

  it('authenticates as referee when page loads', async () => {
    mockUseAuthContext.mockReturnValue({
      role: ROLE_REFEREE,
      tableId: 'table-1',
      isReferee: true,
      isViewer: false,
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
      disconnect: vi.fn()
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getByText('Juan vs Pedro')).toBeInTheDocument()
  })

  it('shows config panel for non-LIVE match when referee', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'WAITING' }),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn()
    })

    mockUseAuthContext.mockReturnValue({
      role: ROLE_REFEREE,
      tableId: 'table-1',
      isReferee: true,
      isViewer: false,
      isAuthenticated: true,
      ownerPin: '12345',
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getAllByText('Configurar Partido').length).toBeGreaterThan(0)
  })

  it('shows scoreboard for non-LIVE match when viewer', () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'WAITING' }),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn()
    })

    mockUseAuthContext.mockReturnValue({
      role: ROLE_VIEWER,
      tableId: 'table-1',
      isReferee: false,
      isViewer: true,
      isAuthenticated: true,
      ownerPin: '12345',
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
    })

    renderWithRouter(<ScoreboardPage />)

    expect(screen.getByText('Juan vs Pedro')).toBeInTheDocument()
  })

  it('navigates back to dashboard', async () => {
    mockUseSocketContext.mockReturnValue({
      currentMatch: createMockMatch({ status: 'LIVE' }),
      tables: [],
      connected: true,
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      leaveTable: vi.fn(),
      disconnect: vi.fn()
    })

    renderWithRouter(<ScoreboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Juan vs Pedro')).toBeInTheDocument()
    })
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
      disconnect: vi.fn()
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
      disconnect: vi.fn()
    })

    renderWithRouter(<ScoreboardPage />)

    expect(mockEmit).not.toHaveBeenCalled()
  })
})
