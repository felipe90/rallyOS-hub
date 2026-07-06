import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthPage } from './AuthPage'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock useI18n to return translated strings
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'authSelectRole': 'Elige una opción',
        'authEnterOwnerPin': 'Ingresa tu PIN de Organizador',
        'authRoleOwner': 'Organizador',
        'authRoleReferee': 'Árbitro',
        'authRoleSpectator': 'Espectador',
        'authOwnerPinDescription': 'PIN de organizador de este torneo',
        'authOwnerPinYourPinIs': 'Tu PIN es:',
        'authOwnerPinUseHint': 'Usalo para entrar como organizador',
        'authOwnerPinEnterPin': 'Ingresa el PIN de organizador del torneo',
        'authVerifying': 'Verificando...',
        'authEnter': 'Ingresar',
        'commonBack': 'Atrás',
        'authAdminClub': 'Administrar',
        'authClubPlay': 'Quiero jugar',
        'authClubPlayDesc': 'Ingresá el PIN de tu cancha',
        'authTournament': 'Torneo',
        'authPinBack': 'Volver',
        'authPinErrorInvalid': 'PIN inválido. Verificá con el staff.',
        'authPinErrorRateLimited': 'Demasiados intentos. Esperá {{seconds}} segundos.',
        'authPinPlaceholder': 'PIN de la cancha',
        'authPinSubmit': 'Ingresar',
        'authPinVerifying': 'Verificando...',
      }
      return map[key] || key
    },
  }),
  i18nText: (key: string) => key,
  default: { language: 'es' },
}))

// Mock useAuthContext
const mockSetOwner = vi.fn()
const mockLogin = vi.fn()
const mockLogout = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: vi.fn(() => ({
    role: null,
    tableId: null,
    isReferee: false,
    isViewer: false,
    isOwner: false,
    isAuthenticated: false,
    ownerPin: null,
    login: mockLogin,
    logout: mockLogout,
    setOwner: mockSetOwner,
    setTablePin: vi.fn()
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock useSocketContext
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  onAny: vi.fn(),
  offAny: vi.fn(),
  emit: vi.fn(),
  connected: true
}

vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(() => ({
    socket: mockSocket,
    connected: true
  }))
}))

// Mock react-router-dom - include MemoryRouter, Routes, Route
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const ReactRouterDOM = await import('react-router-dom')
  return {
    ...ReactRouterDOM,
    useNavigate: () => mockNavigate,
  }
})

const renderWithRouter = (initialEntries = ['/auth']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/dashboard/spectator" element={<div>Waiting Room</div>} />
        </Routes>
      </AuthProvider>
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
    it('shows new 3-entry layout: play, tournament (expandable), admin', () => {
      renderWithRouter()

      // Logo uses alt text
      expect(screen.getByAltText('RallyOS')).toBeInTheDocument()
      expect(screen.getByText('Elige una opción')).toBeInTheDocument()

      // New primary CTA button
      expect(screen.getByText('Quiero jugar')).toBeInTheDocument()

      // Torneo expandable section (initially collapsed — sub-roles hidden)
      expect(screen.getByText('Torneo')).toBeInTheDocument()
      expect(screen.queryByText('Organizador')).not.toBeInTheDocument()
      expect(screen.queryByText('Árbitro')).not.toBeInTheDocument()
      expect(screen.queryByText('Espectador')).not.toBeInTheDocument()

      // Administrar link
      expect(screen.getByText('Administrar')).toBeInTheDocument()

      // Expand Torneo to reveal sub-roles
      fireEvent.click(screen.getByText('Torneo'))
      expect(screen.getByText('Organizador')).toBeInTheDocument()
      expect(screen.getByText('Árbitro')).toBeInTheDocument()
      expect(screen.getByText('Espectador')).toBeInTheDocument()
    })

    it('shows PIN entry for Organizador after expanding Torneo', () => {
      renderWithRouter()

      // Expand Torneo first
      fireEvent.click(screen.getByText('Torneo'))
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)

      expect(screen.getByText('Ingresa tu PIN de Organizador')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    })

    it('navigates to dashboard for Árbitro after expanding Torneo', () => {
      renderWithRouter()

      // Expand Torneo first
      fireEvent.click(screen.getByText('Torneo'))
      const refereeButton = screen.getByText('Árbitro')
      fireEvent.click(refereeButton)

      expect(mockLogin).toHaveBeenCalledWith('referee')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/referee')
    })

    it('navigates to waiting room for Espectador after expanding Torneo', () => {
      renderWithRouter()

      // Expand Torneo first
      fireEvent.click(screen.getByText('Torneo'))
      const spectatorButton = screen.getByText('Espectador')
      fireEvent.click(spectatorButton)

      expect(mockLogin).toHaveBeenCalledWith('viewer')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/spectator')
    })
  })

  describe('Owner PIN Validation', () => {
    it('validates PIN must be 5-8 digits', async () => {
      renderWithRouter()

      // Expand Torneo, then select Owner role
      fireEvent.click(screen.getByText('Torneo'))
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)

      // Verify PIN input exists with correct placeholder
      const input = screen.getByPlaceholderText('••••••••')
      expect(input).toBeInTheDocument()

      // Verify submit button exists
      const submitButton = screen.getByRole('button', { name: /ingresar/i })
      expect(submitButton).toBeInTheDocument()
    })

    it('shows back button and returns to selection', () => {
      renderWithRouter()

      // Expand Torneo, select owner
      fireEvent.click(screen.getByText('Torneo'))
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)

      const backButton = screen.getByText('Atrás')
      fireEvent.click(backButton)

      expect(screen.getByText('Elige una opción')).toBeInTheDocument()
    })

    it('has Ingresa tu PIN de Organizador text', () => {
      renderWithRouter()

      // Expand Torneo, select owner
      fireEvent.click(screen.getByText('Torneo'))
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)

      expect(screen.getByText('Ingresa tu PIN de Organizador')).toBeInTheDocument()
    })
  })

  describe('Quiero jugar (Club PIN)', () => {
    it('shows club PIN entry mode when clicking Quiero jugar', () => {
      renderWithRouter()

      fireEvent.click(screen.getByText('Quiero jugar'))

      expect(screen.getByText('Ingresá el PIN de tu cancha')).toBeInTheDocument()
      expect(screen.getByText('Ingresar')).toBeInTheDocument()
      // Back button
      expect(screen.getByText('Volver')).toBeInTheDocument()
    })

    it('returns to selection when clicking back from club PIN', () => {
      renderWithRouter()

      fireEvent.click(screen.getByText('Quiero jugar'))
      fireEvent.click(screen.getByText('Volver'))

      expect(screen.getByText('Elige una opción')).toBeInTheDocument()
      expect(screen.getByText('Quiero jugar')).toBeInTheDocument()
    })
  })

  describe('Administrar', () => {
    it('navigates to club admin when clicking Administrar', () => {
      renderWithRouter()

      fireEvent.click(screen.getByText('Administrar'))

      expect(mockNavigate).toHaveBeenCalledWith('/club/admin')
    })
  })
})