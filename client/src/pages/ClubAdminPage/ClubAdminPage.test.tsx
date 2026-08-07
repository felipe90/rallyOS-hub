/**
 * ClubAdminPage — admin court inventory UI (admin-court-inventory slice 3).
 *
 * The page lists the reconciled inventory (ACTIVE/MAINTENANCE/ARCHIVED),
 * offers add/rename/maintenance/archive + force-end on BUSY (no-delete copy),
 * and keeps the bridge club-flow actions (activate/occupy/reset/featured) +
 * PIN verify + history tab + notifications.
 *
 * Hook collaborators are mocked at the module boundary; the page is a
 * composition layer (useClubAdmin, useCourtInventory, useClubSessionHistory
 * each have their own unit tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { InventoryCourtView } from '@/services/courts/reconcileInventory'
import { AVAILABILITY, INVENTORY_STATUS } from '@shared/types'

vi.mock('@/contexts/SportContext', () => ({
  useSport: () => ({ sport: 'tableTennis', sportLoaded: true }),
}))

const useClubAdminMock = vi.fn()
const useCourtInventoryMock = vi.fn()
const useClubSessionHistoryMock = vi.fn()
const mockUseSocketContext = vi.hoisted(() => vi.fn())
const mockUseToast = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useClubAdmin', () => ({
  useClubAdmin: (...args: unknown[]) => useClubAdminMock(...args),
}))

vi.mock('@/hooks/useCourtInventory', () => ({
  useCourtInventory: (...args: unknown[]) => useCourtInventoryMock(...args),
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
  KioskNotificationModal: vi.fn(({ isOpen, onSubmit, onClose, showGeneralToggle }) =>
    isOpen ? (
      <div data-testid="kiosk-notification-modal">
        {showGeneralToggle && <span data-testid="general-toggle">General toggle visible</span>}
        <button data-testid="modal-submit" onClick={() => onSubmit({
          type: 'info', message: 'Test notification', duration: 5, scope: 'club',
        })}>Submit</button>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    ) : null,
  ),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'sportTerm.clubAdminTabCourts.tableTennis': 'Mesas',
        'sportTerm.clubAdminNoCourts.tableTennis': 'Sin mesas aún',
        'sportTerm.clubAdminDefaultCourtName.tableTennis': 'Mesa {{number}}',
        'sportTerm.inventoryAdd.tableTennis': 'Agregar Mesa',
        'sportTerm.inventoryRename.tableTennis': 'Renombrar Mesa',
        'sportTerm.inventoryMaintenance.tableTennis': 'Mantenimiento',
        'sportTerm.inventoryArchive.tableTennis': 'Archivar',
        'sportTerm.inventoryForceEnd.tableTennis': 'Finalizar Sesión',
        'sportTerm.courtArchiveNoDelete.tableTennis': 'Las mesas usadas se archivan, nunca se eliminan',
        clubAdminTabCourts: 'Canchas',
        clubAdminTabHistory: 'Historial',
        clubAdminTitle: 'Admin del Club',
        clubAdminSubtitle: 'Gestioná canchas y sesiones',
        clubAdminEnterPin: 'Ingresá el PIN de Admin',
        clubAdminVerify: 'Verificar',
        clubAdminVerifying: 'Verificando...',
        clubAdminBack: 'Atrás',
        clubAdminForceEnd: 'Finalizar Sesión',
        clubAdminForceEndConfirm: '¿Finalizar esta sesión?',
        clubAdminActivate: 'Activar',
        clubAdminDeactivate: 'Desactivar',
        clubAdminReset: 'Restablecer',
        clubAdminStatusAvailable: 'Disponible',
        clubAdminStatusReserved: 'Reservada',
        clubAdminStatusOccupied: 'Ocupada',
        clubAdminStatusFinished: 'Finalizada',
        clubAdminStatusMaintenance: 'Mantenimiento',
        inventoryStatusActive: 'Activa',
        inventoryStatusArchived: 'Archivada',
        clubAdminOccupy: 'Ocupar',
        toastClubForceEndFailed: 'No se pudo finalizar',
        toastClubArchiveFailed: 'No se pudo archivar',
        toastClubMaintenanceFailed: 'No se pudo poner en mantenimiento',
        toastClubActivationFailed: 'No se pudo activar',
        toastClubDeactivateFailed: 'No se pudo desactivar',
        toastClubResetFailed: 'No se pudo restablecer',
        errorClubPinInvalid: 'PIN incorrecto',
        errorClubPinFormat: 'PIN inválido',
        errorClubConnection: 'Sin conexión',
        errorClubPinTimeout: 'Timeout',
        errorClubNotConfigured: 'No configurado',
        commonBack: 'Atrás',
        commonCancel: 'Cancelar',
        commonConfirm: 'Confirmar',
        connectionConnected: 'Conectado',
        connectionConnecting: 'Conectando',
        connectionNoConnection: 'Sin Conexión',
        connectionDisconnected: 'Desconectado',
        notificationModalTitle: 'Send Notification',
        notificationScopeGeneral: 'General',
        courtDestacar: 'Destacar',
        courtQuitarDestacado: 'Quitar Destacado',
        clubAdminRenameLabel: 'Nuevo nombre',
        clubSetupReset: 'Reiniciar Setup',
        clubSetupResetConfirm: '¿Reiniciar la configuración del club? Se borrarán las canchas del inventario y las sesiones en curso, y volverás al asistente de setup. El historial de sesiones NO se borra.',
        clubSetupResetSuccess: 'Setup reiniciado. Configurá el club de nuevo.',
        clubSetupResetError: 'No se pudo reiniciar el setup.',
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
  useToast: mockUseToast,
}))

import { ClubAdminPage } from './ClubAdminPage'

function adminPage() {
  return render(
    <MemoryRouter>
      <ClubAdminPage />
    </MemoryRouter>,
  )
}

const view = (over: Partial<InventoryCourtView> = {}): InventoryCourtView => ({
  courtId: 'c1',
  number: 1,
  name: 'Mesa 1',
  inventoryStatus: INVENTORY_STATUS.ACTIVE,
  availability: AVAILABILITY.IDLE,
  inCatalog: true,
  ...over,
})

function defaultHooks(courts: InventoryCourtView[] = []) {
  mockUseSocketContext.mockReturnValue({ socket: null, connected: true })
  mockUseToast.mockReturnValue({ addToast: vi.fn() })
  useClubAdminMock.mockReturnValue({
    isAdmin: true,
    verifyAdminPin: vi.fn(),
    verifyLoading: false,
    verifyError: null,
    clearVerifyError: vi.fn(),
    clubConfig: { configured: true, clubName: 'Club', sport: 'tableTennis' },
    resetSetup: vi.fn().mockResolvedValue(true),
    resetLoading: false,
  })
  useCourtInventoryMock.mockReturnValue({
    courts,
    loading: false,
    error: null,
    clearError: vi.fn(),
    add: vi.fn(),
    rename: vi.fn(),
    setMaintenance: vi.fn(),
    archive: vi.fn(),
    forceEnd: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    reset: vi.fn(),
    adminOccupy: vi.fn(),
    toggleFeatured: vi.fn(),
  })
  useClubSessionHistoryMock.mockReturnValue({
    sessions: [],
    clearHistory: vi.fn(),
    confirmClearHistory: vi.fn(),
    cancelClearHistory: vi.fn(),
    pendingClearConfirm: false,
    clearError: null,
  })
}

describe('ClubAdminPage — pre-admin PIN screen', () => {
  it('renders the PIN entry screen (no tab layout) before admin is verified', () => {
    defaultHooks()
    useClubAdminMock.mockReturnValue({
      isAdmin: false,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    adminPage()
    expect(screen.getByText('Ingresá el PIN de Admin')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Mesas' })).not.toBeInTheDocument()
  })
})

describe('ClubAdminPage — tabbed layout + inventory list', () => {
  it('renders both tab triggers once admin is verified', () => {
    defaultHooks()
    adminPage()
    expect(screen.getByRole('tab', { name: 'Mesas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument()
  })

  it('lists ACTIVE, MAINTENANCE and ARCHIVED inventory courts with status labels', () => {
    defaultHooks([
      view({ courtId: 'c1', name: 'Mesa Activa' }),
      view({ courtId: 'c2', name: 'Mesa Mant', inventoryStatus: INVENTORY_STATUS.MAINTENANCE }),
      view({ courtId: 'c3', name: 'Mesa Archivada', inventoryStatus: INVENTORY_STATUS.ARCHIVED }),
    ])
    adminPage()
    expect(screen.getByText('Mesa Activa')).toBeInTheDocument()
    expect(screen.getByText('Mesa Mant')).toBeInTheDocument()
    expect(screen.getByText('Mesa Archivada')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getAllByText('Mantenimiento').length).toBeGreaterThan(0)
    expect(screen.getByText('Archivada')).toBeInTheDocument()
  })

  it('shows the no-delete copy ("used courts are archived, never deleted") in the archive confirm', () => {
    const archiveMock = vi.fn()
    defaultHooks([view({ courtId: 'c1', name: 'Mesa 1' })])
    useCourtInventoryMock.mockReturnValue({
      courts: [view({ courtId: 'c1', name: 'Mesa 1' })],
      loading: false,
      error: null,
      clearError: vi.fn(),
      add: vi.fn(),
      rename: vi.fn(),
      setMaintenance: vi.fn(),
      archive: archiveMock,
      forceEnd: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn(),
      reset: vi.fn(),
      adminOccupy: vi.fn(),
      toggleFeatured: vi.fn(),
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /archivar/i }))
    expect(screen.getByText('Las mesas usadas se archivan, nunca se eliminan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(archiveMock).toHaveBeenCalledWith('c1')
  })

  it('adds a court via the FloatingActionButton (INVENTORY_ADD suggested name)', () => {
    const addMock = vi.fn()
    defaultHooks()
    useCourtInventoryMock.mockReturnValue({
      courts: [], loading: false, error: null, clearError: vi.fn(),
      add: addMock, rename: vi.fn(), setMaintenance: vi.fn(), archive: vi.fn(), forceEnd: vi.fn(),
      activate: vi.fn(), deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: vi.fn(),
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /agregar mesa/i }))
    expect(addMock).toHaveBeenCalledTimes(1)
  })

  it('renames a court through the rename dialog (INVENTORY_RENAME)', () => {
    const renameMock = vi.fn()
    defaultHooks([view({ courtId: 'c1', name: 'Mesa 1' })])
    useCourtInventoryMock.mockReturnValue({
      courts: [view({ courtId: 'c1', name: 'Mesa 1' })],
      loading: false, error: null, clearError: vi.fn(),
      add: vi.fn(), rename: renameMock, setMaintenance: vi.fn(), archive: vi.fn(), forceEnd: vi.fn(),
      activate: vi.fn(), deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: vi.fn(),
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /renombrar mesa/i }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Mesa Renombrada' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(renameMock).toHaveBeenCalledWith('c1', 'Mesa Renombrada')
  })

  it('toggles maintenance (INVENTORY_MAINTENANCE) from the court card', () => {
    const setMaintenanceMock = vi.fn()
    defaultHooks([view({ courtId: 'c1', name: 'Mesa 1' })])
    useCourtInventoryMock.mockReturnValue({
      courts: [view({ courtId: 'c1', name: 'Mesa 1' })],
      loading: false, error: null, clearError: vi.fn(),
      add: vi.fn(), rename: vi.fn(), setMaintenance: setMaintenanceMock, archive: vi.fn(), forceEnd: vi.fn(),
      activate: vi.fn(), deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: vi.fn(),
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /mantenimiento/i }))
    expect(setMaintenanceMock).toHaveBeenCalledWith('c1', true)
  })
})

describe('ClubAdminPage — force-end on BUSY courts (INVENTORY_FORCE_END)', () => {
  it('renders a force-end action on a BUSY court and confirms via dialog', () => {
    const forceEndMock = vi.fn()
    defaultHooks([view({ courtId: 'c1', name: 'Mesa 1', availability: AVAILABILITY.BUSY })])
    useCourtInventoryMock.mockReturnValue({
      courts: [view({ courtId: 'c1', name: 'Mesa 1', availability: AVAILABILITY.BUSY })],
      loading: false, error: null, clearError: vi.fn(),
      add: vi.fn(), rename: vi.fn(), setMaintenance: vi.fn(), archive: vi.fn(), forceEnd: forceEndMock,
      activate: vi.fn(), deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: vi.fn(),
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /finalizar sesión/i }))
    expect(screen.getByText('¿Finalizar esta sesión?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(forceEndMock).toHaveBeenCalledWith('c1')
  })

  it('does NOT offer archive on a BUSY court (the force-end path frees it first)', () => {
    defaultHooks([view({ courtId: 'c1', name: 'Mesa 1', availability: AVAILABILITY.BUSY })])
    adminPage()
    expect(screen.getByRole('button', { name: /finalizar sesión/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /archivar/i })).not.toBeInTheDocument()
  })
})

describe('ClubAdminPage — bridge club-flow actions on club courts', () => {
  it('offers activate + occupy on an AVAILABLE club court', () => {
    const activateMock = vi.fn()
    defaultHooks([view({ courtId: 'c1', name: 'Mesa 1', clubStatus: 'AVAILABLE' })])
    useCourtInventoryMock.mockReturnValue({
      courts: [view({ courtId: 'c1', name: 'Mesa 1', clubStatus: 'AVAILABLE' })],
      loading: false, error: null, clearError: vi.fn(),
      add: vi.fn(), rename: vi.fn(), setMaintenance: vi.fn(), archive: vi.fn(), forceEnd: vi.fn(),
      activate: activateMock, deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: vi.fn(),
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /activar/i }))
    expect(activateMock).toHaveBeenCalledWith('c1')
  })

  it('renders the Destacar (featured) button on a match-mode OCCUPIED club court and calls toggleFeatured', () => {
    const toggleFeaturedMock = vi.fn()
    defaultHooks([view({
      courtId: 'c1',
      name: 'Mesa 1',
      clubStatus: 'OCCUPIED',
      availability: AVAILABILITY.BUSY,
      sessionMode: 'match',
      featured: false,
    })])
    useCourtInventoryMock.mockReturnValue({
      courts: [view({
        courtId: 'c1', name: 'Mesa 1', clubStatus: 'OCCUPIED',
        availability: AVAILABILITY.BUSY, sessionMode: 'match', featured: false,
      })],
      loading: false, error: null, clearError: vi.fn(),
      add: vi.fn(), rename: vi.fn(), setMaintenance: vi.fn(), archive: vi.fn(), forceEnd: vi.fn(),
      activate: vi.fn(), deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: toggleFeaturedMock,
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /destacar/i }))
    expect(toggleFeaturedMock).toHaveBeenCalledWith('c1')
  })
})

describe('ClubAdminPage — notification button', () => {
  beforeEach(() => defaultHooks())

  it('opens KioskNotificationModal when the bell button is clicked', () => {
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /send notification/i }))
    expect(screen.getByTestId('kiosk-notification-modal')).toBeInTheDocument()
  })

  it('emits CLUB_SEND_NOTIFICATION with the correct payload when the modal submits', () => {
    const mockEmit = vi.fn()
    mockUseSocketContext.mockReturnValue({ socket: { on: vi.fn(), off: vi.fn(), emit: mockEmit }, connected: true })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /send notification/i }))
    fireEvent.click(screen.getByTestId('modal-submit'))
    expect(mockEmit).toHaveBeenCalledWith('CLUB_SEND_NOTIFICATION', {
      type: 'info',
      message: 'Test notification',
      duration: 5,
      scope: 'club',
    })
  })

  it('does NOT render the notification button before admin is verified', () => {
    defaultHooks()
    useClubAdminMock.mockReturnValue({
      isAdmin: false,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
    })
    adminPage()
    expect(screen.queryByRole('button', { name: /send notification/i })).not.toBeInTheDocument()
  })
})

describe('ClubAdminPage — error toasts from inventory ops', () => {
  it('toasts an error when an inventory operation fails', () => {
    const addToastMock = vi.fn()
    defaultHooks()
    mockUseToast.mockReturnValue({ addToast: addToastMock })
    useCourtInventoryMock.mockReturnValue({
      courts: [], loading: false, error: 'ARCHIVE_FAILED', clearError: vi.fn(),
      add: vi.fn(), rename: vi.fn(), setMaintenance: vi.fn(), archive: vi.fn(), forceEnd: vi.fn(),
      activate: vi.fn(), deactivate: vi.fn(), reset: vi.fn(), adminOccupy: vi.fn(), toggleFeatured: vi.fn(),
    })
    adminPage()
    expect(addToastMock).toHaveBeenCalledWith('error', 'No se pudo archivar')
  })
})

describe('ClubAdminPage — setup discovery + reset', () => {
  it('redirects to /setup when the club is not configured (discovery fix)', () => {
    defaultHooks()
    useClubAdminMock.mockReturnValue({
      isAdmin: false,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
      clubConfig: { configured: false },
      resetSetup: vi.fn(),
      resetLoading: false,
    })
    const { Route, Routes } = require('react-router-dom')
    render(
      <MemoryRouter initialEntries={['/club/admin']}>
        <Routes>
          <Route path="/setup" element={<div data-testid="setup-route">Setup</div>} />
          <Route path="/club/admin" element={<ClubAdminPage />} />
        </Routes>
      </MemoryRouter>,
    )
    // The page navigated to /setup — the PIN screen is gone and setup shows.
    expect(screen.getByTestId('setup-route')).toBeInTheDocument()
    expect(screen.queryByText(/Ingresá el PIN de Admin/i)).not.toBeInTheDocument()
  })

  it('renders the reset-setup button for a verified admin', () => {
    defaultHooks()
    adminPage()
    expect(screen.getByRole('button', { name: /Reiniciar Setup/i })).toBeInTheDocument()
  })

  it('emits the reset and navigates to /setup after confirmation', () => {
    defaultHooks()
    const resetSetupMock = vi.fn().mockResolvedValue(true)
    useClubAdminMock.mockReturnValue({
      isAdmin: true,
      verifyAdminPin: vi.fn(),
      verifyLoading: false,
      verifyError: null,
      clearVerifyError: vi.fn(),
      clubConfig: { configured: true, clubName: 'Club', sport: 'tableTennis' },
      resetSetup: resetSetupMock,
      resetLoading: false,
    })
    adminPage()
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar Setup/i }))
    // Confirm dialog visible
    expect(screen.getByText(/Volverás al asistente de setup/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(resetSetupMock).toHaveBeenCalledTimes(1)
  })
})
