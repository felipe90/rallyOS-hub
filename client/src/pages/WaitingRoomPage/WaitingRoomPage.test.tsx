import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { WaitingRoomPage } from './WaitingRoomPage'
import { AuthProvider } from '../../contexts/AuthContext'

vi.mock('../../contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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

import { useAuthContext } from '../../contexts/AuthContext'
import { useSocketContext } from '../../contexts/SocketContext'

const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>
const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

const createMockTables = () => [
  {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'WAITING' as const,
    pin: '12345',
    playerCount: 2,
    playerNames: { a: 'Juan', b: 'Pedro' }
  },
  {
    id: 'table-2',
    number: 2,
    name: 'Mesa 2',
    status: 'WAITING' as const,
    pin: '67890',
    playerCount: 2,
    playerNames: { a: 'Maria', b: 'Carlos' }
  },
  {
    id: 'table-3',
    number: 3,
    name: 'Mesa 3',
    status: 'LIVE' as const,
    pin: '11111',
    playerCount: 2,
    playerNames: { a: 'Lucas', b: 'Sofia' }
  }
]

const defaultMockContext = () => ({
  currentMatch: null,
  tables: createMockTables(),
  connected: true,
  emit: vi.fn(),
  createTable: vi.fn(),
  joinTable: vi.fn(),
  leaveTable: vi.fn(),
  disconnect: vi.fn()
})

const defaultMockAuth = () => ({
  role: 'viewer' as const,
  tableId: null,
  isReferee: false,
  isViewer: true,
  isAuthenticated: true,
  ownerPin: null,
  login: vi.fn(),
  logout: vi.fn(),
  setOwner: vi.fn(),
  setTablePin: vi.fn(),
})

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/waitingroom']}>
      <AuthProvider>
        <Routes>
          <Route path="/waitingroom" element={ui} />
          <Route path="/scoreboard/:tableId" element={<div>Scoreboard</div>} />
          <Route path="/auth" element={<div>Auth</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('WaitingRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    mockUseSocketContext.mockReturnValue(defaultMockContext())
    mockUseAuthContext.mockReturnValue(defaultMockAuth())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders available tables', () => {
    mockUseSocketContext.mockReturnValue(defaultMockContext())
    mockUseAuthContext.mockReturnValue(defaultMockAuth())
    
    renderWithRouter(<WaitingRoomPage />)

    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Mesa 2')).toBeInTheDocument()
  })

  it('shows message when no tables available', () => {
    mockUseSocketContext.mockReturnValue({
      ...defaultMockContext(),
      tables: []
    })
    mockUseAuthContext.mockReturnValue(defaultMockAuth())
    
    renderWithRouter(<WaitingRoomPage />)

    expect(screen.getByText('No hay mesas disponibles')).toBeInTheDocument()
  })

  it('filters out non-WAITING tables', () => {
    mockUseSocketContext.mockReturnValue(defaultMockContext())
    mockUseAuthContext.mockReturnValue(defaultMockAuth())
    
    renderWithRouter(<WaitingRoomPage />)

    expect(screen.queryByText('Mesa 3')).not.toBeInTheDocument()
  })

  it('shows title "Mesas Disponibles"', () => {
    mockUseSocketContext.mockReturnValue(defaultMockContext())
    mockUseAuthContext.mockReturnValue(defaultMockAuth())
    
    renderWithRouter(<WaitingRoomPage />)

    expect(screen.getByText('Mesas Disponibles')).toBeInTheDocument()
  })

  it('displays table names with player names', () => {
    mockUseSocketContext.mockReturnValue(defaultMockContext())
    mockUseAuthContext.mockReturnValue(defaultMockAuth())
    
    renderWithRouter(<WaitingRoomPage />)

    expect(screen.getByText('Juan vs Pedro')).toBeInTheDocument()
    expect(screen.getByText('Maria vs Carlos')).toBeInTheDocument()
  })
})
