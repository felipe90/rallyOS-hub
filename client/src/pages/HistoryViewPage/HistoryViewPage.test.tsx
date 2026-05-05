import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderWithProviders } from '@/test/test-utils'
import { useAuthContext } from '@/contexts/AuthContext'

import type { AllHistoryEntry } from '@shared/types'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual('@/contexts/AuthContext')
  return {
    ...(actual as any),
    useAuthContext: vi.fn(),
  }
})

const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>

const createMockSocketEmit = () => vi.fn()

const createAllHistoryEntry = (overrides: Partial<AllHistoryEntry> = {}): AllHistoryEntry => ({
  tableId: 'table-1',
  tableName: 'Mesa 1',
  status: 'LIVE',
  playerNames: { a: 'Juan', b: 'María' },
  history: [
    {
      id: 'evt-1',
      player: 'A',
      action: 'POINT',
      pointsBefore: { a: 0, b: 0 },
      pointsAfter: { a: 1, b: 0 },
      timestamp: Date.now() - 60000,
    },
    {
      id: 'evt-2',
      player: 'B',
      action: 'POINT',
      pointsBefore: { a: 1, b: 0 },
      pointsAfter: { a: 1, b: 1 },
      timestamp: Date.now() - 30000,
    },
  ],
  ...overrides,
})

const createMultiTableEntries = (): AllHistoryEntry[] => [
  createAllHistoryEntry({ tableId: 'table-1', tableName: 'Mesa 1' }),
  createAllHistoryEntry({
    tableId: 'table-2',
    tableName: 'Mesa 2',
    playerNames: { a: 'Carlos', b: 'Ana' },
    history: [
      {
        id: 'evt-3',
        player: 'A',
        action: 'CORRECTION',
        pointsBefore: { a: 5, b: 3 },
        pointsAfter: { a: 4, b: 3 },
        timestamp: Date.now(),
      },
    ],
  }),
]

describe('HistoryViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: user is owner, so page renders normally
    mockUseAuthContext.mockReturnValue({
      isOwner: true,
      isReferee: false,
      role: 'owner',
      isViewer: false,
      isAuthenticated: true,
      tableId: null,
      ownerPin: null,
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
      tablePin: null,
    })
  })

  it('emits GET_ALL_HISTORY on mount', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    const mockSocketEmit = createMockSocketEmit()

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          socket: { emit: mockSocketEmit } as any,
          connected: true,
          allHistories: null,
          currentMatch: null,
        },
      }
    )

    await waitFor(() => {
      expect(mockSocketEmit).toHaveBeenCalledWith('GET_ALL_HISTORY')
    })
  })

  it('shows loading state when allHistories is null and connected', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          connected: true,
          allHistories: null,
          currentMatch: null,
        },
      }
    )

    expect(screen.getByText('Cargando historial…')).toBeInTheDocument()
  })

  it('shows empty state when all tables have no history', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          connected: true,
          allHistories: [],
          currentMatch: null,
        },
      }
    )

    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument()
  })

  it('renders table sections when history entries exist', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')
    const entries = createMultiTableEntries()

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          connected: true,
          allHistories: entries,
          currentMatch: null,
        },
      }
    )

    // Should show table names as section headers
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Mesa 2')).toBeInTheDocument()

    // Should show player names with set summary in sections
    expect(screen.getByText('Juan 0-0 María')).toBeInTheDocument()
    expect(screen.getByText('Carlos 0-0 Ana')).toBeInTheDocument()

    // Should show entry count badges
    expect(screen.getByText('2 eventos')).toBeInTheDocument()
    expect(screen.getByText('1 evento')).toBeInTheDocument()
  })

  it('has header with back button and refresh button', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          connected: true,
          allHistories: [],
          currentMatch: null,
        },
      }
    )

    expect(screen.getByRole('heading', { name: /historial/i })).toBeInTheDocument()
    expect(screen.getByText('Atrás')).toBeInTheDocument()
  })

  it('redirects non-owners to referee dashboard', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')

    mockUseAuthContext.mockReturnValue({
      isOwner: false,
      isReferee: true,
      role: 'referee',
      isViewer: false,
      isAuthenticated: true,
      tableId: null,
      ownerPin: null,
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
      tablePin: null,
    })

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          connected: true,
          allHistories: [],
          currentMatch: null,
        },
      }
    )

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/referee')
  })

  it('redirects spectators to spectator dashboard', async () => {
    const { HistoryViewPage } = await import('./HistoryViewPage')

    mockUseAuthContext.mockReturnValue({
      isOwner: false,
      isReferee: false,
      role: 'viewer',
      isViewer: true,
      isAuthenticated: true,
      tableId: null,
      ownerPin: null,
      login: vi.fn(),
      logout: vi.fn(),
      setOwner: vi.fn(),
      setTablePin: vi.fn(),
      tablePin: null,
    })

    renderWithProviders(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HistoryViewPage />} />
        </Routes>
      </MemoryRouter>,
      {
        mockSocketContext: {
          connected: true,
          allHistories: [],
          currentMatch: null,
        },
      }
    )

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/spectator')
  })
})
