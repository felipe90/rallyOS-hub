import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock useI18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        clubPlayLoading: 'Conectando...',
        clubPlayFinished: 'Partido finalizado',
        clubPlayGoHome: 'Volver al inicio',
        clubPlayNameA: 'Jugador 1',
        clubPlayNameB: 'Jugador 2',
        clubPlayScoreA: 'Jugador 1',
        clubPlayScoreB: 'Jugador 2',
        clubPlayStartMatch: 'Comenzar partido',
        clubPlayNamePlaceholder: 'Tu nombre (opcional)',
        connectionConnected: 'Conectado',
        connectionConnecting: 'Conectando',
        connectionNoConnection: 'Sin Conexión',
        connectionDisconnected: 'Desconectado',
        scoreboardInvalidCourtId: 'ID de cancha inválido',
        toastConnectionError: 'Error de conexión',
        scoreboardLoading: 'Cargando partido...',
        matchConfigPlayers: 'Jugadores',
      }
      if (params && map[key]) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
          map[key]
        )
      }
      return map[key] || key
    },
  }),
}))

// Mock socket context
const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, onAny: vi.fn(), offAny: vi.fn() }
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(() => ({ socket: mockSocket, connected: true })),
}))

// Mock useClubPlay hook
const mockUseClubPlay = vi.fn()
vi.mock('@/hooks/useClubPlay', () => ({ useClubPlay: () => mockUseClubPlay() }))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock child components
vi.mock('@/components/organisms/ScoreboardMain', () => ({
  ScoreboardMain: () => <div data-testid="scoreboard-main">Scoreboard</div>,
}))
vi.mock('@/components/molecules/PlayerNamePrompt/PlayerNamePrompt', () => ({
  PlayerNamePrompt: ({ defaultNameA, defaultNameB }: { defaultNameA?: string; defaultNameB?: string }) => (
    <div data-testid="player-name-prompt">
      <span>{defaultNameA}</span>
      <span>{defaultNameB}</span>
      <button>Submit</button>
    </div>
  ),
}))
vi.mock('@/components/atoms/ConnectionStatus', () => ({
  ConnectionStatus: ({ labels }: { labels: Record<string, string> }) => <span>{labels.connecting}</span>,
}))
vi.mock('@/components/atoms/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    <button onClick={onClick}>{children}</button>,
}))
vi.mock('@/components/atoms/Typography', () => ({
  Typography: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

import { ClubPlayPage } from './ClubPlayPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/club/play/court-1']}>
      <Routes>
        <Route path="/club/play/:courtId" element={<ClubPlayPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ClubPlayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseClubPlay.mockReturnValue({
      matchState: null,
      loading: true,
      error: null,
      finished: false,
      scorePoint: vi.fn(),
      startMatch: vi.fn(),
    })
  })

  it('renders loading state while connecting', () => {
    renderPage()
    expect(screen.getByText('Conectando...')).toBeInTheDocument()
  })

  it('renders scoreboard in playing state', () => {
    mockUseClubPlay.mockReturnValue({
      matchState: {
        courtId: 'court-1',
        status: 'LIVE',
        playerNames: { a: 'Player A', b: 'Player B' },
        score: { a: 5, b: 3 },
        setHistory: [{ a: 5, b: 3 }],
      },
      loading: false,
      error: null,
      finished: false,
      scorePoint: vi.fn(),
      startMatch: vi.fn(),
    })

    renderPage()
    expect(screen.getByTestId('scoreboard-main')).toBeInTheDocument()
  })

  it('renders finished view when match is finished', () => {
    mockUseClubPlay.mockReturnValue({
      matchState: {
        courtId: 'court-1',
        status: 'FINISHED',
        playerNames: { a: 'Player A', b: 'Player B' },
        setHistory: [{ a: 2, b: 1 }],
      },
      loading: false,
      error: null,
      finished: true,
      scorePoint: vi.fn(),
      startMatch: vi.fn(),
    })

    renderPage()
    expect(screen.getByText('Partido finalizado')).toBeInTheDocument()
    expect(screen.getByText('Volver al inicio')).toBeInTheDocument()
  })
})
