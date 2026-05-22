import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OwnerDashboardPage } from './OwnerDashboardPage'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'

// Mock SocketContext
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
}))

// Mock hooks used by OwnerDashboardPage
vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => ({
    totalTables: 0,
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

vi.mock('@/hooks/useRefereeSession', () => ({
  useRefereeSession: () => ({
    saveSession: vi.fn(),
    findAnyValidSession: () => null,
    clearSession: vi.fn(),
  }),
}))

vi.mock('@/hooks/useTableManagement', () => ({
  useTableManagement: () => ({
    isCreatingTable: false,
    tableName: '',
    setTableName: vi.fn(),
    createTable: vi.fn(),
    cancelCreating: vi.fn(),
    startCreating: vi.fn(),
    requestClean: vi.fn(),
    cleanConfirmTableId: null,
    confirmClean: vi.fn(),
    cancelClean: vi.fn(),
    requestDelete: vi.fn(),
    deleteConfirmTableId: null,
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
  }),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'ownerTitle': 'Organizer Panel',
        'ownerSubtitle': 'Create tables, manage referees and matches',
        'ownerCreateTable': 'New Table',
        'ownerViewHistory': 'View History',
        'ownerCreate': 'Create',
        'ownerCreating': 'Creating...',
        'ownerTableNamePlaceholder': 'Table name...',
        'commonBack': 'Back',
        'commonCancel': 'Cancel',
        'dashboardStatTables': 'Tables',
        'dashboardStatMatches': 'Matches',
        'dashboardStatPlayers': 'Players',
        'dashboardGridView': 'Grid view',
        'dashboardListView': 'List view',
        'connectionConnected': 'Connected',
        'connectionConnecting': 'Connecting',
        'connectionNoConnection': 'No Connection',
        'connectionDisconnected': 'Disconnected',
        'ownerCreateNotification': 'Create Notification',
        'finishTournament': 'End Tournament',
        'finishTournamentConfirm': 'End tournament? It will be archived and can no longer be edited.',
        'finishTournamentExportCsv': 'Export CSV before finishing',
        'exportCsv': 'Export CSV',
        'tournamentFinishSuccess': 'Tournament finished and archived',
      }
      return map[key] || key
    },
    language: 'en-US',
    changeLanguage: vi.fn(),
  }),
}))

// Mock the KioskNotificationModal to verify it renders and captures submit
vi.mock('@/components/molecules/KioskNotificationModal', () => ({
  KioskNotificationModal: vi.fn(({
    isOpen,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: { type: string; message: string; duration: number }) => void
  }) =>
    isOpen ? (
      <div data-testid="kiosk-notification-modal">
        <button data-testid="modal-close" onClick={onClose}>Close modal</button>
        <button
          data-testid="modal-submit"
          onClick={() => onSubmit({ type: 'info', message: 'Test notification', duration: 5 })}
        >
          Submit notification
        </button>
      </div>
    ) : null
  ),
}))

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>
const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>

function createTable(overrides: Record<string, unknown> = {}) {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'WAITING',
    playerCount: 0,
    ...overrides,
  }
}

function renderPage(options?: {
  customSocket?: Partial<ReturnType<typeof useSocketContext>>
  customAuth?: Partial<ReturnType<typeof useAuthContext>>
}) {
  const defaultSocket = {
    socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    requestTablesWithPins: vi.fn(),
    appError: null,
  }

  mockUseSocketContext.mockReturnValue({
    tables: [],
    connected: true,
    connecting: false,
    ...defaultSocket,
    ...options?.customSocket,
  })

  mockUseAuthContext.mockReturnValue({
    ownerPin: '12345678',
    tournamentToken: 'test-token-uuid',
    isOwner: true,
    isReferee: false,
    isViewer: false,
    isAuthenticated: true,
    role: 'OWNER',
    tableId: null,
    tablePin: null,
    login: vi.fn(),
    logout: vi.fn(),
    setOwner: vi.fn(),
    setTablePin: vi.fn(),
    setTournamentToken: vi.fn(),
    ...options?.customAuth,
  })

  return render(
    <MemoryRouter>
      <OwnerDashboardPage />
    </MemoryRouter>
  )
}

describe('OwnerDashboardPage — Notification Button', () => {
  it('renders Create Notification button in dashboardActions', () => {
    renderPage()
    expect(screen.getByText('Create Notification')).toBeInTheDocument()
  })

  it('opens the KioskNotificationModal when Create Notification is clicked', () => {
    renderPage()
    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Create Notification'))

    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()
  })

  it('closes the KioskNotificationModal when onClose is called', () => {
    renderPage()

    fireEvent.click(screen.getByText('Create Notification'))
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('modal-close'))

    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()
  })

  it('emits SEND_NOTIFICATION with correct payload when modal submits', () => {
    const mockEmit = vi.fn()
    renderPage({
      customSocket: {
        socket: { on: vi.fn(), off: vi.fn(), emit: mockEmit },
      },
    })

    fireEvent.click(screen.getByText('Create Notification'))
    fireEvent.click(screen.getByTestId('modal-submit'))

    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledWith('SEND_NOTIFICATION', {
      pin: '12345678',
      type: 'info',
      message: 'Test notification',
      duration: 5,
    })

    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()
  })
})

describe('OwnerDashboardPage — End Tournament Button', () => {
  it('renders End Tournament button when tables exist', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'LIVE' })],
      },
    })
    expect(screen.getByText('End Tournament')).toBeInTheDocument()
  })

  it('does NOT render End Tournament button when no tables exist', () => {
    renderPage({
      customSocket: {
        tables: [],
      },
    })
    expect(screen.queryByText('End Tournament')).not.toBeInTheDocument()
  })

  it('does NOT render End Tournament button for non-owners', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'LIVE' })],
      },
      customAuth: {
        isOwner: false,
        isReferee: true,
        role: 'REFEREE',
      },
    })
    expect(screen.queryByText('End Tournament')).not.toBeInTheDocument()
  })

  it('shows confirmation dialog when End Tournament is clicked', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'LIVE' })],
      },
    })

    fireEvent.click(screen.getByText('End Tournament'))

    // Confirm dialog should appear with the finish message and checkbox
    expect(screen.getByText('End tournament? It will be archived and can no longer be edited.')).toBeInTheDocument()
    expect(screen.getByText('Export CSV before finishing')).toBeInTheDocument()
  })

  it('shows Export CSV checkbox in confirmation dialog, default checked', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'LIVE' })],
      },
    })

    fireEvent.click(screen.getByText('End Tournament'))

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('closes confirmation dialog when Cancel is clicked', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'LIVE' })],
      },
    })

    fireEvent.click(screen.getByText('End Tournament'))
    expect(screen.getByText('End tournament? It will be archived and can no longer be edited.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('End tournament? It will be archived and can no longer be edited.')).not.toBeInTheDocument()
  })
})

describe('OwnerDashboardPage — Export CSV Button', () => {
  it('renders Export CSV button when FINISHED tables exist', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'FINISHED' })],
      },
    })
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('does NOT render Export CSV button when no FINISHED tables exist', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'LIVE' })],
      },
    })
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument()
  })

  it('does NOT render Export CSV button for non-owners', () => {
    renderPage({
      customSocket: {
        tables: [createTable({ status: 'FINISHED' })],
      },
      customAuth: {
        isOwner: false,
        isReferee: true,
        role: 'REFEREE',
      },
    })
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument()
  })

  it('opens export URL in new tab when Export CSV is clicked', () => {
    const openSpy = vi.fn()
    const originalOpen = window.open
    window.open = openSpy

    renderPage({
      customSocket: {
        tables: [createTable({ status: 'FINISHED' })],
      },
    })

    fireEvent.click(screen.getByText('Export CSV'))

    expect(openSpy).toHaveBeenCalledWith('/api/export/matches.csv', '_blank')

    window.open = originalOpen
  })
})
