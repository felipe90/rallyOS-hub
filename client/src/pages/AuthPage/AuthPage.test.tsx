import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthPage, REFEREE_PIN } from './index'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn()
}))

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const renderWithRouter = (initialEntries: string[] = ['/auth']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuthPage', () => {
  let mockLogin: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockLogin = vi.fn()
    mockNavigate.mockClear()
    
    vi.clearAllMocks()
    localStorage.clear()
    
    mockUseAuth.mockReturnValue({
      role: null,
      tableId: null,
      isReferee: false,
      isViewer: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Role Selection', () => {
    it('shows role selection initially', () => {
      renderWithRouter()
      
      expect(screen.getByText('RallyOS')).toBeInTheDocument()
      expect(screen.getByText('Elige tu rol')).toBeInTheDocument()
      expect(screen.getAllByText('Espectador').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Árbitro').length).toBeGreaterThan(0)
    })

    it('shows PIN entry for referee', () => {
      renderWithRouter()
      
      const refereeButton = screen.getAllByText('Árbitro')[0]
      fireEvent.click(refereeButton)
      
      expect(screen.getByText('Ingresa tu PIN')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('•••••')).toBeInTheDocument()
    })

    it('navigates back to role selection', () => {
      renderWithRouter()
      
      const refereeButton = screen.getAllByText('Árbitro')[0]
      fireEvent.click(refereeButton)
      
      const backButton = screen.getByText('Atrás')
      fireEvent.click(backButton)
      
      expect(screen.getByText('Elige tu rol')).toBeInTheDocument()
    })
  })

  describe('PIN Validation', () => {
    it('validates PIN must be 5 digits', () => {
      renderWithRouter()
      
      const refereeButton = screen.getAllByText('Árbitro')[0]
      fireEvent.click(refereeButton)
      
      const input = screen.getByPlaceholderText('•••••')
      const submitButton = screen.getByText('Ingresar').closest('button')
      
      expect(submitButton).toBeDisabled()
      
      fireEvent.change(input, { target: { value: '1234' } })
      expect(submitButton).toBeDisabled()
      
      fireEvent.change(input, { target: { value: '12345' } })
      expect(submitButton).not.toBeDisabled()
    })

    it('shows error for invalid PIN', async () => {
      renderWithRouter()
      
      const refereeButton = screen.getAllByText('Árbitro')[0]
      fireEvent.click(refereeButton)
      
      const input = screen.getByPlaceholderText('•••••')
      const submitButton = screen.getByText('Ingresar').closest('button')
      
      fireEvent.change(input, { target: { value: '00000' } })
      fireEvent.click(submitButton!)
      
      await waitFor(() => {
        expect(screen.getByText(/PIN inválido/i)).toBeInTheDocument()
      })
    })

    it('accepts valid PIN', async () => {
      renderWithRouter()
      
      const refereeButton = screen.getAllByText('Árbitro')[0]
      fireEvent.click(refereeButton)
      
      const input = screen.getByPlaceholderText('•••••')
      const submitButton = screen.getByText('Ingresar').closest('button')
      
      fireEvent.change(input, { target: { value: REFEREE_PIN } })
      fireEvent.click(submitButton!)
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('referee')
      })
    })
  })

  describe('Spectator Login', () => {
    it('login as spectator skips PIN', () => {
      renderWithRouter()
      
      const spectatorButton = screen.getAllByText('Espectador')[0]
      fireEvent.click(spectatorButton)
      
      expect(mockLogin).toHaveBeenCalledWith('viewer')
    })

    it('navigates to waiting-room after successful login', async () => {
      renderWithRouter()
      
      const spectatorButton = screen.getAllByText('Espectador')[0]
      fireEvent.click(spectatorButton)
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/waiting-room')
      })
    })
  })

  describe('Navigation', () => {
    it('navigates to dashboard after referee login', async () => {
      renderWithRouter()
      
      const refereeButton = screen.getAllByText('Árbitro')[0]
      fireEvent.click(refereeButton)
      
      const input = screen.getByPlaceholderText('•••••')
      const submitButton = screen.getByText('Ingresar').closest('button')
      
      fireEvent.change(input, { target: { value: REFEREE_PIN } })
      fireEvent.click(submitButton!)
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })
})
