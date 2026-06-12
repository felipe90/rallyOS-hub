import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RefereeDashboardPage } from './RefereeDashboardPage'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        refereeTitle: 'Panel de Árbitro',
        refereeSubtitle: 'Gestiona tu mesa y arbitra',
        dashboardStatTables: 'Mesas',
        dashboardStatMatches: 'Partidos',
        dashboardStatPlayers: 'Jugadores',
        dashboardGridView: 'Vista en cuadrícula',
        dashboardListView: 'Vista en lista',
        commonBack: 'Atrás',
        connectionConnected: 'Conectado',
        connectionConnecting: 'Conectando',
        connectionNoConnection: 'Sin Conexión',
        connectionDisconnected: 'Desconectado',
        matchConfigTitle: 'Configurar Partido',
        matchConfigForTable: `para ${(params as any)?.tableName || ''}`,
        commonCancel: 'Cancelar',
        authEnter: 'Ingresar',
        authVerifying: 'Verificando...',
        errorPinNoConnection: 'Sin conexión',
        errorPinInvalid: 'PIN inválido',
        errorPinAssignFailed: 'No se pudo asignar el árbitro',
        errorPinTimeout: 'Tiempo de espera agotado',
        errorPinDisconnected: 'Conexión perdida',
      }
      return map[key] || key
    },
    language: 'es',
    changeLanguage: vi.fn(),
  }),
  SUPPORTED_LANGS: [{ code: 'es', label: 'ES' }, { code: 'en-US', label: 'EN' }],
  default: { language: 'es' },
}))

// Mock SocketContext
const mockRequestCourts = vi.fn()
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock AuthContext
const mockSetCourtPin = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
}))

// Mock hooks
vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => ({
    totalTables: 1,
    liveMatches: 0,
    activePlayers: 0,
  }),
}))

vi.mock('@/hooks/usePinSubmission', () => ({
  usePinSubmission: () => ({
    submitPin: vi.fn(),
    loading: false,
    error: null,
    clearError: vi.fn(),
  }),
}))

import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>
const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>

describe('RefereeDashboardPage — session persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockNavigate.mockClear()

    mockUseSocketContext.mockReturnValue({
      courts: [
        {
          id: 'court-1',
          number: 1,
          name: 'Mesa 1',
          status: 'LIVE',
          playerCount: 2,
          playerNames: { a: 'Alice', b: 'Bob' },
          currentScore: { a: 0, b: 0 },
        },
      ],
      connected: true,
      requestCourts: mockRequestCourts,
      socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    })

    mockUseAuthContext.mockReturnValue({
      logout: vi.fn(),
      setCourtPin: mockSetCourtPin,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('auto-navigates to scoreboard when valid session exists for LIVE court', () => {
    // Pre-populate localStorage with valid session
    localStorage.setItem(
      'rallyos_ref_session_court-1',
      JSON.stringify({ pin: '4821', joinedAt: Date.now() }),
    )

    render(
      <MemoryRouter>
        <RefereeDashboardPage />
      </MemoryRouter>,
    )

    // Should navigate to scoreboard, skipping PinModal
    expect(mockNavigate).toHaveBeenCalledWith('/scoreboard/court-1/referee')
    expect(mockSetCourtPin).toHaveBeenCalledWith('4821')
  })

  it('shows PinModal when no valid session exists', () => {
    // Empty localStorage — no saved session
    render(
      <MemoryRouter>
        <RefereeDashboardPage />
      </MemoryRouter>,
    )

    // Should NOT auto-navigate
    expect(mockNavigate).not.toHaveBeenCalled()

    // Dashboard should render normally (title visible)
    expect(screen.getByText('Panel de Árbitro')).toBeInTheDocument()
  })

  it('does not auto-navigate when session court is FINISHED', () => {
    // Pre-populate localStorage with session for a FINISHED court
    localStorage.setItem(
      'rallyos_ref_session_court-1',
      JSON.stringify({ pin: '4821', joinedAt: Date.now() }),
    )

    mockUseSocketContext.mockReturnValue({
      courts: [
        {
          id: 'court-1',
          number: 1,
          name: 'Mesa 1',
          status: 'FINISHED',
          playerCount: 0,
          playerNames: { a: 'Alice', b: 'Bob' },
          currentScore: { a: 21, b: 18 },
        },
      ],
      connected: true,
      requestCourts: mockRequestCourts,
      socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    })

    render(
      <MemoryRouter>
        <RefereeDashboardPage />
      </MemoryRouter>,
    )

    // Should NOT auto-navigate since court is FINISHED
    expect(mockNavigate).not.toHaveBeenCalled()

    // Stale session should have been cleared
    expect(localStorage.getItem('rallyos_ref_session_court-1')).toBeNull()
  })
})
