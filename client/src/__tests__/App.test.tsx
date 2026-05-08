import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

// Mock SocketContext — provide minimal context
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: () => ({
    tables: [
      {
        id: 'table-1',
        number: 1,
        name: 'Mesa Kiosk',
        status: 'LIVE',
        playerCount: 2,
        playerNames: { a: 'Alice', b: 'Bob' },
        currentScore: { a: 7, b: 5 },
      },
    ],
    connected: true,
    connecting: false,
    error: null,
  }),
  SocketProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    isAuthenticated: false,
    role: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock hooks used by App
vi.mock('@/hooks/useAutoUpdate', () => ({
  useAutoUpdateBanner: () => ({ Banner: null }),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'kioskNoActiveMatches': 'No active matches',
        'kioskPageTitle': 'Scoreboard',
        'kioskStatusLive': 'LIVE',
        'kioskStatusPaused': 'Paused',
        'kioskStatusFinished': 'Finished',
        'commonPlayerA': 'Player A',
        'commonPlayerB': 'Player B',
        'commonVs': 'vs',
        'connectionConnected': 'Connected',
        'connectionConnecting': 'Connecting',
        'connectionNoConnection': 'No Connection',
        'connectionDisconnected': 'Disconnected',
      }
      return map[key] || key
    },
    language: 'en-US',
    changeLanguage: vi.fn(),
  }),
  SUPPORTED_LANGS: [
    { code: 'es', label: 'ES' },
    { code: 'en-US', label: 'EN' },
  ],
  default: { language: 'en-US' },
}))

describe('App routing', () => {
  it('renders kiosk page at /scoreboard/all/kiosk without auth', () => {
    render(
      <MemoryRouter initialEntries={['/scoreboard/all/kiosk']}>
        <App />
      </MemoryRouter>
    )

    // The kiosk page should render its content — the table name from our mock
    expect(screen.getByText('Mesa Kiosk')).toBeInTheDocument()
  })

  it('redirects to /auth when accessing protected root without auth', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Root should redirect to auth (which renders "Choose your role")
    expect(screen.getByText('authSelectRole')).toBeInTheDocument()
  })
})
