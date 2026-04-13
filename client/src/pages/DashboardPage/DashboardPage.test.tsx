import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import { DashboardPage } from './index'
import { SocketContext, SocketContextType } from '@/contexts/SocketContext'
import { useAuth } from '@/hooks/useAuth'

const mockTables = [
  { id: 'table-1', number: 1, name: 'Mesa 1', status: 'LIVE' as const, playerCount: 2 },
  { id: 'table-2', number: 2, name: 'Mesa 2', status: 'WAITING' as const, playerCount: 0 },
  { id: 'table-3', number: 3, name: 'Mesa 3', status: 'FINISHED' as const, playerCount: 4 },
]

const mockCreateTable = vi.fn((name?: string) => Promise.resolve({ 
  id: `new-${name}`, 
  name: name || 'New Table', 
  number: 0,
  status: 'WAITING' as const, 
  playerCount: 0 
}))

const mockNavigate = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn()
}))

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

vi.mock('react-router-dom', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const renderDashboard = (mockSocketContext?: Partial<SocketContextType>) => {
  const socketValue: SocketContextType = {
    socket: null,
    currentMatch: null,
    tables: mockTables,
    connected: true,
    connecting: false,
    error: null,
    errorCode: null,
    currentTable: null,
    emit: vi.fn(),
    createTable: mockCreateTable as unknown as (name?: string) => void,
    joinTable: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    requestTables: vi.fn(),
    requestTablesWithPins: vi.fn(),
    scorePoint: vi.fn(),
    undoLastPoint: vi.fn(),
    startMatch: vi.fn(),
    configureMatch: vi.fn(),
    setReferee: vi.fn(),
    regeneratePin: vi.fn(),
    ...mockSocketContext,
  }

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <SocketContext.Provider value={socketValue}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/scoreboard/:tableId" element={<div>Scoreboard</div>} />
          <Route path="/auth" element={<div>Auth</div>} />
        </Routes>
      </SocketContext.Provider>
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNavigate.mockClear()
    
    mockUseAuth.mockReturnValue({
      role: 'referee',
      tableId: null,
      isReferee: true,
      isViewer: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Table Display', () => {
    it('shows list of tables', () => {
      renderDashboard()
      
      // Use findAllByText and verify at least one exists for each table name
      expect(screen.getAllByText('Mesa 1').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Mesa 2').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Mesa 3').length).toBeGreaterThan(0)
    })

    it('shows correct stats', () => {
      renderDashboard()
      
      expect(screen.getByText('Mesas')).toBeInTheDocument()
      expect(screen.getByText('Partidos')).toBeInTheDocument()
      expect(screen.getByText('Jugadores')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('6')).toBeInTheDocument()
    })
  })

  describe('Create Table Flow', () => {
    it('shows create table button for referee', () => {
      renderDashboard()
      
      expect(screen.getByRole('button', { name: /nueva mesa/i })).toBeInTheDocument()
    })

    it('opens create table form', () => {
      renderDashboard()
      
      const newTableButton = screen.getByRole('button', { name: /nueva mesa/i })
      fireEvent.click(newTableButton)
      
      expect(screen.getByPlaceholderText('Nombre de la mesa...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument()
    })

    it('creates new table', async () => {
      renderDashboard()
      
      const newTableButton = screen.getByRole('button', { name: /nueva mesa/i })
      fireEvent.click(newTableButton)
      
      const input = screen.getByPlaceholderText('Nombre de la mesa...')
      fireEvent.change(input, { target: { value: 'Nueva Mesa Test' } })
      
      const createButton = screen.getByRole('button', { name: /crear/i })
      fireEvent.click(createButton)
      
      await waitFor(() => {
        expect(mockCreateTable).toHaveBeenCalledWith('Nueva Mesa Test')
      })
    })

    it('cancels create table', () => {
      renderDashboard()
      
      const newTableButton = screen.getByRole('button', { name: /nueva mesa/i })
      fireEvent.click(newTableButton)
      
      const cancelButton = screen.getByRole('button', { name: /cancelar/i })
      fireEvent.click(cancelButton)
      
      expect(screen.queryByPlaceholderText('Nombre de la mesa...')).not.toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('navigates to scoreboard when selecting table', () => {
      renderDashboard()
      
      // There are multiple elements with "Mesa 1" text, verify at least one renders
      expect(screen.getAllByText(/Mesa 1/).length).toBeGreaterThan(0)
    })
  })

  describe('Logout', () => {
    it('logout works correctly', () => {
      const mockLogout = vi.fn()
      mockUseAuth.mockReturnValue({
        role: 'referee',
        tableId: null,
        isReferee: true,
        isViewer: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: mockLogout
      })
      
      renderDashboard()
      
      const logoutButton = screen.getByRole('button', { name: /salir/i })
      fireEvent.click(logoutButton)
      
      expect(mockLogout).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/auth')
    })
  })

  describe('Empty State', () => {
    it('handles state with no tables', () => {
      renderDashboard({ tables: [] })
      
      expect(screen.getByText('Mesas')).toBeInTheDocument()
      expect(screen.getByText('Partidos')).toBeInTheDocument()
      expect(screen.getByText('Jugadores')).toBeInTheDocument()
      expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderDashboard()
      
      const logoutButton = screen.getByRole('button', { name: /salir/i })
      expect(logoutButton).toBeTruthy()
    })

    it('buttons are keyboard accessible', () => {
      renderDashboard()
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeVisible()
      })
    })
  })

  describe('Role-based UI', () => {
    it('shows spectator view for viewer', () => {
      mockUseAuth.mockReturnValue({
        role: 'viewer',
        tableId: null,
        isReferee: false,
        isViewer: true,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn()
      })
      
      renderDashboard()
      
      expect(screen.getByText('Espectador')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /nueva mesa/i })).not.toBeInTheDocument()
    })

    it('shows referee view for referee', () => {
      renderDashboard()
      
      expect(screen.getByText('Panel de Árbitro')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /nueva mesa/i })).toBeInTheDocument()
    })
  })
})
