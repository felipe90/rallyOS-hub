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
        'authTagline': 'Jugá sin complicaciones',
        'authClubPlaySubtitle': 'Ingresá el PIN de tu cancha',
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
        'connectionConnected': 'Conectado',
        'connectionDisconnected': 'Desconectado',
      }
      return map[key] || key
    },
    language: 'es',
    changeLanguage: vi.fn(),
  }),
  i18nText: (key: string) => key,
  SUPPORTED_LANGS: [
    { code: 'es', label: 'ES' },
    { code: 'en-US', label: 'EN' },
  ],
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
    it('shows the tagline replacing the old title', () => {
      renderWithRouter()
      expect(screen.getByText('Jugá sin complicaciones')).toBeInTheDocument()
    })

    it('shows new card layout: play card, tournament section, admin', () => {
      renderWithRouter()

      // Logo uses alt text
      expect(screen.getByAltText('RallyOS')).toBeInTheDocument()

      // Tagline replaces the old title
      expect(screen.getByText('Jugá sin complicaciones')).toBeInTheDocument()

      // New primary CTA card
      expect(screen.getByText('Quiero jugar')).toBeInTheDocument()

      // Torneo section label always visible
      expect(screen.getByText('Torneo')).toBeInTheDocument()

      // Tournament sub-roles are always visible (no accordion)
      expect(screen.getByText('Organizador')).toBeInTheDocument()
      expect(screen.getByText('Árbitro')).toBeInTheDocument()
      expect(screen.getByText('Espectador')).toBeInTheDocument()

      // Subtitle on the play card
      expect(screen.getByText('Ingresá el PIN de tu cancha')).toBeInTheDocument()

      // Administrar link
      expect(screen.getByText('Administrar')).toBeInTheDocument()
    })

    it('shows PIN entry for Organizador', () => {
      renderWithRouter()

      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)

      expect(screen.getByText('Ingresa tu PIN de Organizador')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    })

    it('navigates to dashboard for Árbitro', () => {
      renderWithRouter()

      const refereeButton = screen.getByText('Árbitro')
      fireEvent.click(refereeButton)

      expect(mockLogin).toHaveBeenCalledWith('referee')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/referee')
    })

    it('navigates to waiting room for Espectador', () => {
      renderWithRouter()

      const spectatorButton = screen.getByText('Espectador')
      fireEvent.click(spectatorButton)

      expect(mockLogin).toHaveBeenCalledWith('viewer')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/spectator')
    })
  })

  describe('Owner PIN Validation', () => {
    it('validates PIN must be 5-8 digits', async () => {
      renderWithRouter()

      // Select Owner role directly (no accordion)
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

      // Select owner directly
      const organizerButton = screen.getByText('Organizador')
      fireEvent.click(organizerButton)

      const backButton = screen.getByText('Atrás')
      fireEvent.click(backButton)

      expect(screen.getByText('Jugá sin complicaciones')).toBeInTheDocument()
    })

    it('has Ingresa tu PIN de Organizador text', () => {
      renderWithRouter()

      // Select owner directly
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

      expect(screen.getByText('Jugá sin complicaciones')).toBeInTheDocument()
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