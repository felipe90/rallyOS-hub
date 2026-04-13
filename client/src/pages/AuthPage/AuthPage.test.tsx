import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthPage } from './AuthPage'

// Mock useAuth
const mockSetOwner = vi.fn()
const mockLogin = vi.fn()
const mockLogout = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    role: null,
    tableId: null,
    isReferee: false,
    isViewer: false,
    isOwner: false,
    isAuthenticated: false,
    login: mockLogin,
    logout: mockLogout,
    setOwner: mockSetOwner
  }))
}))

// Mock useSocketContext
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true
}

vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(() => ({
    socket: mockSocket,
    connected: true
  }))
}))

// Mock react-router-dom - only mock useNavigate since we import the rest from the real module
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const renderWithRouter = (initialEntries = ['/auth']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/waiting-room" element={<div>Waiting Room</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockLogin.mockReset()
    mockLogout.mockReset()
    mockSetOwner.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Role Selection', () => {
    it('shows role selection initially with 3 buttons', () => {
      renderWithRouter()
      
      expect(screen.getByText('RallyOS')).toBeInTheDocument()
      expect(screen.getByText('Elige tu rol')).toBeInTheDocument()
      expect(screen.getByText('Organizador')).toBeInTheDocument()
      expect(screen.getByText('Árbitro')).toBeInTheDocument()
      expect(screen.getByText('Espectador')).toBeInTheDocument()
    })

    it('shows PIN entry for Organizador', () => {
      renderWithRouter()
      
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)
      
      expect(screen.getByText('Ingresa tu PIN de Organizador')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('•••••')).toBeInTheDocument()
    })

    it('navigates to dashboard for Árbitro', () => {
      renderWithRouter()
      
      const refereeButton = screen.getByText('Árbitro')
      fireEvent.click(refereeButton)
      
      expect(mockLogin).toHaveBeenCalledWith('referee')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    it('navigates to waiting room for Espectador', () => {
      renderWithRouter()
      
      const spectatorButton = screen.getByText('Espectador')
      fireEvent.click(spectatorButton)
      
      expect(mockLogin).toHaveBeenCalledWith('viewer')
      expect(mockNavigate).toHaveBeenCalledWith('/waiting-room')
    })
  })

  describe('Owner PIN Validation', () => {
    it('validates PIN must be 5 digits', async () => {
      renderWithRouter()
      
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)
      
      const input = screen.getByPlaceholderText('•••••')
      const submitButton = screen.getByText('Ingresar').closest('button')
      
      expect(submitButton).toBeDisabled()
      
      fireEvent.change(input, { target: { value: '1234' } })
      // Wait for React state update
      await new Promise(r => setTimeout(r, 50))
      expect(submitButton).toBeDisabled()
      
      fireEvent.change(input, { target: { value: '12345' } })
      // Wait for React state update
      await new Promise(r => setTimeout(r, 50))
      expect(submitButton).not.toBeDisabled()
    })

    it('shows back button and returns to selection', () => {
      renderWithRouter()
      
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)
      
      const backButton = screen.getByText('Atrás')
      fireEvent.click(backButton)
      
      expect(screen.getByText('Elige tu rol')).toBeInTheDocument()
    })

    it('has Ingresa tu PIN de Organizador text', () => {
      renderWithRouter()
      
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)
      
      expect(screen.getByText('Ingresa tu PIN de Organizador')).toBeInTheDocument()
    })
  })
})