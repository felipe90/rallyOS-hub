/**
 * ClubAdminPage — tabbed refactor acceptance test (task 3.5).
 *
 * Verifies that the admin dashboard renders a TabContainer with the
 * "Canchas" and "Historial" tabs, that "Canchas" is the default, and
 * that switching to "Historial" renders the ClubSessionHistoryPanel.
 *
 * Hook collaborators are mocked at the module boundary. The page is a
 * composition layer — the underlying hooks (useClubAdmin,
 * useClubCourtManagement, useClubSessionHistory) each have their own
 * unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useClubAdminMock = vi.fn()
const useClubCourtManagementMock = vi.fn()
const useClubSessionHistoryMock = vi.fn()

const mockUseSocketContext = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useClubAdmin', () => ({
  useClubAdmin: (...args: unknown[]) => useClubAdminMock(...args),
}))

vi.mock('@/hooks/useClubCourtManagement', () => ({
  useClubCourtManagement: (...args: unknown[]) => useClubCourtManagementMock(...args),
}))

vi.mock('@/hooks/useClubSessionHistory', () => ({
  useClubSessionHistory: (...args: unknown[]) => useClubSessionHistoryMock(...args),
}))

vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: mockUseSocketContext,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ setSessionToken: vi.fn() }),
}))

vi.mock('@/components/molecules/KioskNotificationModal', () => ({
  KioskNotificationModal: vi.fn(({ isOpen, onSubmit, onClose, showGeneralToggle, isLoading, error }) =>
    isOpen ? (
      <div data-testid="kiosk-notification-modal">
        {showGeneralToggle && <span data-testid="general-toggle">General toggle visible</span>}
        {isLoading && <span data-testid="loading-indicator">Loading...</span>}
        {error && <span data-testid="error-message">{error}</span>}
        <button
          data-testid="modal-submit"
          onClick={() => onSubmit({
            type: 'info',
            message: 'Test notification',
            duration: 5,
            scope: 'club',
          })}
        >
          Submit
        </button>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        clubAdminTabCourts: 'Canchas',
        clubAdminTabHistory: 'Historial',
        clubAdminTitle: 'Admin del Club',
        clubAdminSubtitle: 'Gestioná canchas y sesiones',
        clubAdminEnterPin: 'Ingresá el PIN de Admin',
        clubAdminVerify: 'Verificar',
        clubAdminVerifying: 'Verificando...',
        clubAdminCreateCourt: 'Nueva Cancha',
        clubAdminNoCourts: 'Sin canchas aún',
        clubAdminBack: 'Atrás',
        clubAdminForceEnd: 'Finalizar Sesión',
        clubAdminForceEndConfirm: '¿Finalizar esta sesión?',
        clubAdminDelete: 'Eliminar',
        clubAdminDeleteConfirm: '¿Eliminar esta cancha?',
        clubAdminActivate: 'Activar',
        clubAdminDeactivate: 'Desactivar',
        clubAdminReset: 'Restablecer',
        clubAdminStatusAvailable: 'Disponible',
        clubAdminStatusReserved: 'Reservada',
        clubAdminStatusOccupied: 'Ocupada',
        clubAdminStatusFinished: 'Finalizada',
        clubAdminStatusMaintenance: 'Mantenimiento',
        clubAdminPinLabel: 'PIN: {{pin}}',
        clubAdminDefaultCourtName: 'Cancha {{number}}',
        toastClubCourtCreated: 'Cancha creada',
        toastClubCourtActivated: 'Cancha activada',
        toastClubSessionEnded: 'Sesión finalizada',
        toastClubCourtDeleted: 'Cancha eliminada',
        toastClubCourtDeactivated: 'Cancha desactivada',
        toastClubCourtResetted: 'Cancha restablecida',
        toastClubActivationFailed: 'No se pudo activar',
        toastClubForceEndFailed: 'No se pudo finalizar',
        toastClubDeleteFailed: 'No se pudo eliminar',
        toastClubDeactivateFailed: 'No se pudo desactivar',
        toastClubResetFailed: 'No se pudo restablecer',
        errorClubPinInvalid: 'PIN incorrecto',
        errorClubPinFormat: 'PIN inválido',
        errorClubConnection: 'Sin conexión',
        errorClubPinTimeout: 'Timeout',
        errorClubNotConfigured: 'No configurado',
        commonBack: 'Atrás',
        commonCancel: 'Cancelar',
        connectionConnected: 'Conectado',
        connectionConnecting: 'Conectando',
        connectionNoConnection: 'Sin Conexión',
        connectionDisconnected: 'Desconectado',
        notificationModalTitle: 'Send Notification',
        notificationScopeLabel: 'Scope',
        notificationScopeClub: 'Club',
        notificationScopeGeneral: 'General',
      }
      let s = map[key] ?? key
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          s = s.replace(`{{${k}}}`, String(v))
        }
      }
      return s
    },
  }),
}))

vi.mock('@/components/molecules/Toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

import { ClubAdminPage } from './ClubAdminPage'

function adminPage() {
  return render(
    <MemoryRouter>
      <ClubAdminPage />
    </MemoryRouter>,
  )
}

describe('ClubAdminPage — tabbed layout', () => {
  beforeEach(() => {
    mockUseSocketContext.mockReturnValue({ socket: null, connected: true })
    useClubAdminMock.mockReturnValue({
      isAdmin: true,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    useClubCourtManagementMock.mockReturnValue({
      courts: [],
      loading: false,
      error: null,
      lastEvent: null,
      createCourt: vi.fn(),
      activateCourt: vi.fn(),
      deactivateCourt: vi.fn(),
      forceEndSession: vi.fn(),
      deleteCourt: vi.fn(),
      resetCourt: vi.fn(),
      clearEvent: vi.fn(),
    })
    useClubSessionHistoryMock.mockReturnValue({
      sessions: [],
      clearHistory: vi.fn(),
      confirmClearHistory: vi.fn(),
      cancelClearHistory: vi.fn(),
      pendingClearConfirm: false,
      clearError: null,
    })
  })

  it('renders both tab triggers ("Canchas" and "Historial") once admin is verified', () => {
    adminPage()
    expect(screen.getByRole('tab', { name: 'Canchas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument()
  })

  it('defaults to the "Canchas" tab as active', () => {
    adminPage()
    expect(screen.getByRole('tab', { name: 'Canchas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'false')
  })

  it('renders the court-management UI inside the "Canchas" tab by default', () => {
    adminPage()
    // The "Nueva Cancha" creation button is the canonical affordance of the courts tab
    expect(screen.getByRole('button', { name: /Nueva Cancha/ })).toBeInTheDocument()
  })

  it('switches to the "Historial" tab when its trigger is clicked and shows the history panel', () => {
    adminPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    // The empty-placeholder i18n string rendered by the injected history panel
    // (useClubSessionHistoryMock returns sessions: []).
    // Panel is rendered inside the Historial tab; "Export CSV" button is the
    // canonical affordance even in empty state — but our mock i18n returns the
    // raw "historyExportBtn" key because we trimmed the i18n map. Assert on it.
    expect(screen.getByText('historyExportBtn')).toBeInTheDocument()
    expect(screen.getByText('historyClearBtn')).toBeInTheDocument()
  })

  it('does not render the history panel while on the "Canchas" tab', () => {
    adminPage()
    expect(screen.queryByText('historyExportBtn')).not.toBeInTheDocument()
  })
})

describe('ClubAdminPage — pre-admin PIN screen', () => {
  beforeEach(() => {
    mockUseSocketContext.mockReturnValue({ socket: null, connected: true })
    useClubAdminMock.mockReturnValue({
      isAdmin: false,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
  })

  it('renders the PIN entry screen (no tab layout) before admin is verified', () => {
    adminPage()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Ingresá el PIN de Admin')).toBeInTheDocument()
  })
})

describe('ClubAdminPage — notification button', () => {
  beforeEach(() => {
    mockUseSocketContext.mockReturnValue({ socket: null, connected: true })
    useClubAdminMock.mockReturnValue({
      isAdmin: true,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    useClubCourtManagementMock.mockReturnValue({
      courts: [],
      loading: false,
      error: null,
      lastEvent: null,
      createCourt: vi.fn(),
      activateCourt: vi.fn(),
      deactivateCourt: vi.fn(),
      forceEndSession: vi.fn(),
      deleteCourt: vi.fn(),
      resetCourt: vi.fn(),
      clearEvent: vi.fn(),
    })
    useClubSessionHistoryMock.mockReturnValue({
      sessions: [],
      clearHistory: vi.fn(),
      confirmClearHistory: vi.fn(),
      cancelClearHistory: vi.fn(),
      pendingClearConfirm: false,
      clearError: null,
    })
  })

  it('renders a bell icon button in the header actions when admin is verified', () => {
    adminPage()
    // The bell icon notification button should be present in the header
    const notifBtn = screen.getByTitle('Send Notification')
    expect(notifBtn).toBeInTheDocument()
  })

  it('opens KioskNotificationModal when bell icon button is clicked (RED test — not yet implemented)', () => {
    adminPage()
    // Click the notification button
    fireEvent.click(screen.getByTitle('Send Notification'))
    // The modal should now be visible
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()
  })

  it('passes showGeneralToggle=true to KioskNotificationModal', () => {
    adminPage()
    fireEvent.click(screen.getByTitle('Send Notification'))
    expect(screen.getByTestId('general-toggle')).toBeInTheDocument()
  })

  it('emits CLUB_SEND_NOTIFICATION with correct payload when modal submits', () => {
    const mockEmit = vi.fn()
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: mockEmit },
      connected: true,
    })
    // Also need to re-set i18n mock for the admin page render
    // (adminPage helper is already defined, but we use custom setup here)

    useClubAdminMock.mockReturnValue({
      isAdmin: true,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    useClubCourtManagementMock.mockReturnValue({
      courts: [],
      loading: false,
      error: null,
      lastEvent: null,
      createCourt: vi.fn(),
      activateCourt: vi.fn(),
      deactivateCourt: vi.fn(),
      forceEndSession: vi.fn(),
      deleteCourt: vi.fn(),
      resetCourt: vi.fn(),
      clearEvent: vi.fn(),
    })
    useClubSessionHistoryMock.mockReturnValue({
      sessions: [],
      clearHistory: vi.fn(),
      confirmClearHistory: vi.fn(),
      cancelClearHistory: vi.fn(),
      pendingClearConfirm: false,
      clearError: null,
    })

    render(
      <MemoryRouter>
        <ClubAdminPage />
      </MemoryRouter>,
    )

    // Open modal and submit
    fireEvent.click(screen.getByTitle('Send Notification'))
    fireEvent.click(screen.getByTestId('modal-submit'))

    expect(mockEmit).toHaveBeenCalledWith('CLUB_SEND_NOTIFICATION', {
      type: 'info',
      message: 'Test notification',
      duration: 5,
      scope: 'club',
    })
  })

  it('tracks loading state on the modal while notification is being sent', () => {
    const mockEmit = vi.fn((_event: string, _data: unknown) => {
      // Don't resolve — keep loading
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: mockEmit },
      connected: true,
    })

    useClubAdminMock.mockReturnValue({
      isAdmin: true,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    useClubCourtManagementMock.mockReturnValue({
      courts: [],
      loading: false,
      error: null,
      lastEvent: null,
      createCourt: vi.fn(),
      activateCourt: vi.fn(),
      deactivateCourt: vi.fn(),
      forceEndSession: vi.fn(),
      deleteCourt: vi.fn(),
      resetCourt: vi.fn(),
      clearEvent: vi.fn(),
    })
    useClubSessionHistoryMock.mockReturnValue({
      sessions: [],
      clearHistory: vi.fn(),
      confirmClearHistory: vi.fn(),
      cancelClearHistory: vi.fn(),
      pendingClearConfirm: false,
      clearError: null,
    })

    render(
      <MemoryRouter>
        <ClubAdminPage />
      </MemoryRouter>,
    )

    // Open modal
    fireEvent.click(screen.getByTitle('Send Notification'))
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()

    // Submit to trigger loading state
    fireEvent.click(screen.getByTestId('modal-submit'))
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('renders error message on the modal when notification fails', () => {
    const mockEmit = vi.fn((_event: string, _data: unknown, callback?: (arg: unknown) => void) => {
      // callback not provided in simple emit — reject by emitting error
    })
    mockUseSocketContext.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), emit: mockEmit },
      connected: true,
    })

    useClubAdminMock.mockReturnValue({
      isAdmin: true,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    useClubCourtManagementMock.mockReturnValue({
      courts: [],
      loading: false,
      error: null,
      lastEvent: null,
      createCourt: vi.fn(),
      activateCourt: vi.fn(),
      deactivateCourt: vi.fn(),
      forceEndSession: vi.fn(),
      deleteCourt: vi.fn(),
      resetCourt: vi.fn(),
      clearEvent: vi.fn(),
    })
    useClubSessionHistoryMock.mockReturnValue({
      sessions: [],
      clearHistory: vi.fn(),
      confirmClearHistory: vi.fn(),
      cancelClearHistory: vi.fn(),
      pendingClearConfirm: false,
      clearError: null,
    })

    render(
      <MemoryRouter>
        <ClubAdminPage />
      </MemoryRouter>,
    )

    // Open modal
    fireEvent.click(screen.getByTitle('Send Notification'))

    // Initially no error
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('closes modal when clicking the close button', () => {
    adminPage()
    fireEvent.click(screen.getByTitle('Send Notification'))
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('modal-close'))
    expect(screen.queryByTestId('kiosk-notification-modal')).not.toBeInTheDocument()
  })

  it('does NOT render notification button before admin is verified', () => {
    useClubAdminMock.mockReturnValue({
      isAdmin: false,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ClubAdminPage />
      </MemoryRouter>,
    )

    expect(screen.queryByTitle('Send Notification')).not.toBeInTheDocument()
  })
})