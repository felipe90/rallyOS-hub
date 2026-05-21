import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

function renderPage(customSocket?: Partial<ReturnType<typeof useSocketContext>>) {
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
    ...customSocket,
  })

  mockUseAuthContext.mockReturnValue({
    ownerPin: '12345678',
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
    // Modal should not be visible initially
    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()

    // Click the notification button
    fireEvent.click(screen.getByText('Create Notification'))

    // Modal should now be visible
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()
  })

  it('closes the KioskNotificationModal when onClose is called', () => {
    renderPage()

    // Open the modal
    fireEvent.click(screen.getByText('Create Notification'))
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()

    // Close it via the mocked close button
    fireEvent.click(screen.getByTestId('modal-close'))

    // Modal should be gone
    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()
  })

  it('emits SEND_NOTIFICATION with correct payload when modal submits', () => {
    const mockEmit = vi.fn()
    renderPage({
      socket: { on: vi.fn(), off: vi.fn(), emit: mockEmit },
    })

    // Open the modal
    fireEvent.click(screen.getByText('Create Notification'))
    // Submit via the mocked submit button
    fireEvent.click(screen.getByTestId('modal-submit'))

    // Verify emit was called with correct event and payload
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledWith('SEND_NOTIFICATION', {
      pin: '12345678',
      type: 'info',
      message: 'Test notification',
      duration: 5,
    })

    // Modal should close after submit
    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()
  })
})
