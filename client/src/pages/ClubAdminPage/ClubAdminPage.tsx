/**
 * ClubAdminPage — Admin dashboard for club mode + court inventory
 *
 * Admin Court Inventory (admin-court-inventory slice 3):
 *   - Lists the reconciled inventory (ACTIVE / MAINTENANCE / ARCHIVED) via
 *     useCourtInventory (single catalog + derived availability, INV-6).
 *   - Add (INVENTORY_ADD), rename (INVENTORY_RENAME), maintenance toggle
 *     (INVENTORY_MAINTENANCE), archive (INVENTORY_ARCHIVE) with the
 *     no-delete copy ("used courts are archived, never deleted").
 *   - Force-end (INVENTORY_FORCE_END) on BUSY courts — the admin's general
 *     stop control for ANY live session (club OCCUPIED or tournament LIVE).
 *   - Bridge club-flow actions (activate/deactivate/reset/occupy/featured)
 *     on runtime club courts — the legacy hooks are deleted in slice 5.4.
 * Delegates all business logic to hooks.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CLUB_STATUS, INVENTORY_STATUS } from '@shared/types'
import type { InventoryStatus } from '@shared/types'
import type { KioskNotificationType, SessionMode } from '@shared/types'
import { FloatingActionButton } from '@/components/atoms'
import { Badge } from '@/components/atoms/Badge'
import { PinInput } from '@/components/atoms/PinInput'
import { Button } from '@/components/atoms/Button'
import { Body, Title } from '@/components/atoms/Typography'
import { Tab } from '@/components/atoms/Tab'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { ClubSessionHistoryPanel } from '@/components/molecules/ClubSessionHistoryPanel'
import { AdminOccupyModal } from '@/components/organisms/AdminOccupyModal'
import { KioskNotificationModal } from '@/components/molecules/KioskNotificationModal'
import { useToast } from '@/components/molecules/Toast'
import { useSocketContext } from '@/contexts/SocketContext'
import { SocketEvents } from '@shared/events'
import { useAuthContext } from '@/contexts/AuthContext'
import { useClubAdmin } from '@/hooks/useClubAdmin'
import { useCourtInventory } from '@/hooks/useCourtInventory'
import { useClubSessionHistory } from '@/hooks/useClubSessionHistory'
import type { InventoryCourtView } from '@/services/courts/reconcileInventory'
import { useSportTerms } from '@/hooks/useSportTerms'
import { Routes } from '@/routes'
import logoBig from '@/assets/logo-big.png'
import {
  Play,
  LogOut,
  Building2,
  RefreshCw,
  XCircle,
  ArrowLeft,
  Monitor,
  Trophy,
  UserPlus,
  Plus,
  Bell,
  Star,
  Table2,
  Clock,
  Pencil,
  Archive,
  Wrench,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/** Inventory status label (regular i18n — not sport-aware). */
function inventoryStatusLabel(status: InventoryStatus, i18nText: (key: string) => string): string {
  switch (status) {
    case INVENTORY_STATUS.ACTIVE: return i18nText('inventoryStatusActive')
    case INVENTORY_STATUS.MAINTENANCE: return i18nText('clubAdminStatusMaintenance')
    case INVENTORY_STATUS.ARCHIVED: return i18nText('inventoryStatusArchived')
    default: return status
  }
}

/** Status-based pill class for inventory status */
function inventoryPillClass(status: InventoryStatus): string {
  switch (status) {
    case INVENTORY_STATUS.ACTIVE: return 'bg-emerald-500/10 text-emerald-600'
    case INVENTORY_STATUS.MAINTENANCE: return 'bg-red-500/10 text-red-600'
    case INVENTORY_STATUS.ARCHIVED: return 'bg-gray-500/10 text-gray-500'
    default: return 'bg-surface-low text-text'
  }
}

/** Status-based border colour */
function inventoryBorderClass(status: InventoryStatus): string {
  switch (status) {
    case INVENTORY_STATUS.ACTIVE: return 'border-l-emerald-500'
    case INVENTORY_STATUS.MAINTENANCE: return 'border-l-red-500'
    case INVENTORY_STATUS.ARCHIVED: return 'border-l-gray-400'
    default: return 'border-l-transparent'
  }
}

/** Translate admin PIN verification error codes to user-facing messages */
function translateVerifyError(code: string | null, i18nText: (key: string) => string): string | undefined {
  if (!code) return undefined
  const map: Record<string, string> = {
    INVALID_ADMIN_PIN: i18nText('errorClubPinInvalid'),
    VALIDATION_ERROR: i18nText('errorClubPinFormat'),
    NO_CONNECTION: i18nText('errorClubConnection'),
    TIMEOUT: i18nText('errorClubPinTimeout'),
    DISCONNECTED: i18nText('errorClubConnection'),
    CLUB_NOT_CONFIGURED: i18nText('errorClubNotConfigured'),
  }
  return map[code] || code
}

/** Map inventory/flow operation error codes to user-facing messages */
function translateOperationError(code: string | null, i18nText: (key: string) => string): string {
  const map: Record<string, string> = {
    ARCHIVE_FAILED: i18nText('toastClubArchiveFailed'),
    MAINTENANCE_FAILED: i18nText('toastClubMaintenanceFailed'),
    FORCE_END_FAILED: i18nText('toastClubForceEndFailed'),
    ACTIVATION_FAILED: i18nText('toastClubActivationFailed'),
    DEACTIVATE_FAILED: i18nText('toastClubDeactivateFailed'),
    RESET_FAILED: i18nText('toastClubResetFailed'),
    NO_CONNECTION: i18nText('errorClubConnection'),
  }
  return map[code] || code || ''
}

export function ClubAdminPage() {
  const { socket, connected } = useSocketContext()
  const navigate = useNavigate()
  const { terms, i18nText, sport } = useSportTerms()
  const { setSessionToken } = useAuthContext()
  const { isAdmin, verifyAdminPin, verifyLoading, verifyError, clearVerifyError } =
    useClubAdmin(socket, connected, { setSessionToken })
  const inventory = useCourtInventory(socket, connected)
  // Session history hook is only meaningful once the admin is verified
  // (the server only emits CLUB_SESSION_HISTORY to authenticated sockets).
  // The hook tolerates a null socket without crashing, so we always call it
  // to keep React hook order stable.
  const sessionHistory = useClubSessionHistory(socket, connected)

  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('courts')
  const [adminPin, setAdminPin] = useState('')
  const [forceEndCourt, setForceEndCourt] = useState<InventoryCourtView | null>(null)
  const [renameCourt, setRenameCourt] = useState<InventoryCourtView | null>(null)
  const [renameName, setRenameName] = useState('')
  const [archiveCourtTarget, setArchiveCourtTarget] = useState<InventoryCourtView | null>(null)
  const [kioskMode, setKioskModeState] = useState<'club' | 'tournament'>('club')
  const [occupyCourt, setOccupyCourt] = useState<InventoryCourtView | null>(null)
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [toastedError, setToastedError] = useState<string | null>(null)

  // Toast for operation errors (inventory ops + bridge club-flow ops).
  useEffect(() => {
    if (!inventory.error || inventory.error === toastedError) return
    setToastedError(inventory.error)
    addToast('error', translateOperationError(inventory.error, i18nText))
  }, [inventory.error, toastedError, addToast, i18nText])

  // Listen for server kiosk mode changes
  useEffect(() => {
    if (!socket) return
    const handler = (data: { mode: 'club' | 'tournament' }) => setKioskModeState(data.mode)
    socket.on(SocketEvents.SERVER.KIOSK_MODE, handler)
    return () => { socket.off(SocketEvents.SERVER.KIOSK_MODE, handler) }
  }, [socket])

  // Toast for verify errors
  useEffect(() => {
    if (verifyError === 'NO_CONNECTION' || verifyError === 'DISCONNECTED') {
      addToast('error', i18nText('errorClubConnection'))
    } else if (verifyError === 'TIMEOUT') {
      addToast('error', i18nText('errorClubPinTimeout'))
    } else if (verifyError === 'CLUB_NOT_CONFIGURED') {
      addToast('warning', i18nText('errorClubNotConfigured'))
    } else if (verifyError && verifyError !== 'VALIDATION_ERROR') {
      addToast('error', i18nText('errorClubPinInvalid'))
    }
  }, [verifyError, addToast, i18nText])

  const handleVerify = () => {
    if (adminPin.trim()) {
      verifyAdminPin(adminPin.trim())
    }
  }

  // ── Inventory actions ─────────────────────────────────────────────────

  /** Sport-aware suggested name for the next court (MP-2). */
  const suggestedNextName = (() => {
    let next = inventory.courts.length + 1
    let name = i18nText(`sportTerm.clubAdminDefaultCourtName.${sport}`, { number: String(next) })
    while (inventory.courts.some(c => c.name === name)) {
      next++
      name = i18nText(`sportTerm.clubAdminDefaultCourtName.${sport}`, { number: String(next) })
    }
    return name
  })()

  const handleAddCourt = () => {
    inventory.add(suggestedNextName)
  }

  const handleRenameStart = (court: InventoryCourtView) => {
    setRenameName(court.name)
    setRenameCourt(court)
  }

  const handleRenameConfirm = () => {
    if (renameCourt && renameName.trim()) {
      inventory.rename(renameCourt.courtId, renameName.trim())
      setRenameCourt(null)
    }
  }

  const handleMaintenanceToggle = (court: InventoryCourtView) => {
    const isMaintenance = court.inventoryStatus === INVENTORY_STATUS.MAINTENANCE
    inventory.setMaintenance(court.courtId, !isMaintenance)
  }

  const handleArchiveConfirm = () => {
    if (archiveCourtTarget) {
      inventory.archive(archiveCourtTarget.courtId)
      setArchiveCourtTarget(null)
    }
  }

  const handleForceEndConfirm = () => {
    if (forceEndCourt) {
      inventory.forceEnd(forceEndCourt.courtId)
      setForceEndCourt(null)
    }
  }

  const handleOccupySubmit = useCallback(
    (playerName: string, phone: string, mode: SessionMode) => {
      if (!occupyCourt) return
      inventory.adminOccupy(occupyCourt.courtId, playerName, phone, mode)
      setOccupyCourt(null)
    },
    [occupyCourt, inventory],
  )

  const handleSendNotification = useCallback(
    (data: { type: KioskNotificationType; message: string; duration: number; scope?: 'club' | 'general' }) => {
      if (!socket) return
      setNotificationLoading(true)
      setNotificationError(null)
      socket.emit(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, data)
      setIsNotificationModalOpen(false)
      setNotificationLoading(false)
    },
    [socket],
  )

  // Admin PIN verification screen
  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center min-h-dvh bg-primary/10 gap-6 p-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src={logoBig} alt="RallyOS" className="w-16 h-auto mb-1 rounded-[--radius-md]" />
          <Title className="text-center">{i18nText('clubAdminTitle')}</Title>
          <Body className="text-text/70">{i18nText('clubAdminEnterPin')}</Body>
        </div>

        {/* PIN input */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <PinInput
            length={8}
            value={adminPin}
            onChange={(value) => { setAdminPin(value); clearVerifyError() }}
            onComplete={() => {}}
            placeholder="••••••••"
            disabled={verifyLoading}
            error={translateVerifyError(verifyError, i18nText)}
            autoFocus
          />

          <Button
            variant="primary"
            fullWidth
            onClick={handleVerify}
            loading={verifyLoading}
            disabled={verifyLoading || !adminPin.trim()}
          >
            {verifyLoading ? i18nText('clubAdminVerifying') : i18nText('clubAdminVerify')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={() => navigate(Routes.AUTH)}
            disabled={verifyLoading}
            icon={<ArrowLeft size={16} />}
            className="bg-white/[0.06] border border-white/10 hover:bg-white/[0.12]"
          >
            {i18nText('commonBack')}
          </Button>
        </div>
      </motion.div>
    )
  }

  // Admin dashboard
  return (
    <div className="flex flex-col h-dvh bg-background">
      <PageHeader
        title={i18nText('clubAdminTitle')}
        subtitle={i18nText('clubAdminSubtitle')}
        showStatus
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(Routes.AUTH)} icon={<ArrowLeft size={16} />}>
            {i18nText('clubAdminBack')}
          </Button>
        }
      />

      <main id="main-content" className="flex-1 overflow-auto bg-primary/10">
        {/* Sticky bar: action buttons + integrated tabs */}
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-primary/5">
          <div className="flex flex-wrap items-center gap-1 px-4 py-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setIsNotificationModalOpen(true)}
              icon={<Bell size={14} />}
            >
              {i18nText('notificationModalTitle')}
            </Button>
            <div className="flex gap-1 p-0.5 rounded-lg bg-surface-low border border-border">
              <button
                onClick={() => socket?.emit(SocketEvents.CLIENT.SET_KIOSK_MODE, { mode: 'club' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-150 ${
                  kioskMode === 'club' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                <Monitor size={14} />
                Kiosko
              </button>
              <button
                onClick={() => socket?.emit(SocketEvents.CLIENT.SET_KIOSK_MODE, { mode: 'tournament' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-150 ${
                  kioskMode === 'tournament' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                <Trophy size={14} />
                Torneo
              </button>
            </div>
          </div>
          <div role="tablist" className="flex border-b border-surface-high px-4">
            <Tab
              id="courts"
              label={terms.clubAdminTabCourts}
              icon={<Table2 size={16} />}
              active={activeTab === 'courts'}
              onClick={() => setActiveTab('courts')}
            />
            <Tab
              id="history"
              label={i18nText('clubAdminTabHistory')}
              icon={<Clock size={16} />}
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
            />
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {activeTab === 'courts' ? (
            <div className="space-y-4">
              {inventory.courts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 gap-2"
                >
                  <Building2 size={40} className="text-text/30" />
                  <Body className="text-text/50 text-center">{terms.clubAdminNoCourts}</Body>
                </motion.div>
              ) : (
                <motion.div layout className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {inventory.courts.map((court) => (
                      <motion.div
                        layout
                        key={court.courtId}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`card-light flex flex-col gap-2 p-4 border-l-4 ${inventoryBorderClass(court.inventoryStatus)} transition-colors relative`}
                      >
                        {/* Title row: court name + status pill */}
                        <div className="flex items-center justify-between gap-2">
                          <Body className="font-medium truncate">{court.name}</Body>
                          <div className="flex items-center gap-2">
                            {court.pin && (
                              <Badge className="bg-primary/10 text-primary font-mono font-bold tracking-wider">
                                PIN {court.pin}
                              </Badge>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide shrink-0 ${inventoryPillClass(court.inventoryStatus)}`}>
                              {court.availability === 'BUSY' && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                </span>
                              )}
                              {inventoryStatusLabel(court.inventoryStatus, i18nText)}
                            </span>
                          </div>
                        </div>

                        {/* Player name on an OCCUPIED club court (kiosk parity) */}
                        {court.playerName && (
                          <Body className="text-xs text-text-muted truncate">{court.playerName}</Body>
                        )}

                        {/* Action buttons stacked below */}
                        <div className="flex flex-col gap-2 mt-2">
                          {court.availability === 'BUSY' ? (
                            <>
                              <Button variant="danger" size="xs" fullWidth onClick={() => setForceEndCourt(court)} disabled={inventory.loading} icon={<LogOut size={14} />}>
                                {terms.inventoryForceEnd}
                              </Button>
                              {court.clubStatus === CLUB_STATUS.OCCUPIED && court.sessionMode && court.sessionMode !== 'free' && (
                                <Button variant={court.featured ? 'primary' : 'secondary'} size="xs" fullWidth onClick={() => inventory.toggleFeatured(court.courtId)} disabled={inventory.loading} icon={<Star size={14} className={court.featured ? 'fill-amber-400 text-amber-400' : ''} />}>
                                  {court.featured ? i18nText('courtQuitarDestacado') : i18nText('courtDestacar')}
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              {court.inventoryStatus !== INVENTORY_STATUS.ARCHIVED && (
                                <>
                                  <Button variant="secondary" size="xs" fullWidth onClick={() => handleRenameStart(court)} disabled={inventory.loading} icon={<Pencil size={14} />}>
                                    {terms.inventoryRename}
                                  </Button>
                                  <Button variant="secondary" size="xs" fullWidth onClick={() => handleMaintenanceToggle(court)} disabled={inventory.loading} icon={<Wrench size={14} />}>
                                    {court.inventoryStatus === INVENTORY_STATUS.MAINTENANCE ? i18nText('inventoryMaintenanceOff') : terms.inventoryMaintenance}
                                  </Button>
                                  <Button variant="secondary" size="xs" fullWidth onClick={() => setArchiveCourtTarget(court)} disabled={inventory.loading} icon={<Archive size={14} />}>
                                    {terms.inventoryArchive}
                                  </Button>
                                </>
                              )}
                              {(court.clubStatus === CLUB_STATUS.AVAILABLE || court.clubStatus === undefined) && (
                                <>
                                  <Button variant="primary" size="xs" fullWidth onClick={() => inventory.activate(court.courtId)} disabled={inventory.loading} icon={<Play size={14} />}>
                                    {i18nText('clubAdminActivate')}
                                  </Button>
                                  <Button variant="outline" size="xs" fullWidth onClick={() => setOccupyCourt(court)} disabled={inventory.loading} icon={<UserPlus size={14} />}>
                                    {i18nText('clubAdminOccupy')}
                                  </Button>
                                </>
                              )}
                              {court.clubStatus === CLUB_STATUS.RESERVED && (
                                <>
                                  <Button variant="primary" size="xs" fullWidth onClick={() => setOccupyCourt(court)} disabled={inventory.loading} icon={<UserPlus size={14} />}>
                                    {i18nText('clubAdminOccupy')}
                                  </Button>
                                  <Button variant="ghost" size="xs" fullWidth onClick={() => inventory.deactivate(court.courtId)} disabled={inventory.loading} icon={<XCircle size={14} />}>
                                    {i18nText('clubAdminDeactivate')}
                                  </Button>
                                </>
                              )}
                              {court.clubStatus === CLUB_STATUS.FINISHED && (
                                <Button variant="primary" size="xs" fullWidth onClick={() => inventory.reset(court.courtId)} disabled={inventory.loading} icon={<RefreshCw size={14} />}>
                                  {i18nText('clubAdminReset')}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          ) : (
            <ClubSessionHistoryPanel
              history={sessionHistory}
              clubConfigured={true}
            />
          )}
        </div>
      </main>

      {/* Floating Action Button — Agregar Mesa/Cancha (solo en tab Canchas) */}
      {activeTab === 'courts' && (
      <div className="fixed bottom-6 right-6 z-50">
        <FloatingActionButton
          icon={<Plus size={20} />}
          label={terms.inventoryAdd}
          onClick={handleAddCourt}
          disabled={inventory.loading}
          loading={inventory.loading}
        />
      </div>
      )}

      {/* Admin occupy modal */}
      <AdminOccupyModal
        isOpen={occupyCourt !== null}
        courtName={occupyCourt?.name || ''}
        encryptionKey={null}
        onClose={() => setOccupyCourt(null)}
        onSubmit={handleOccupySubmit}
      />

      {/* Force-end confirmation modal */}
      <ConfirmDialog
        isOpen={forceEndCourt !== null}
        title={i18nText('clubAdminForceEnd')}
        message={`${i18nText('clubAdminForceEndConfirm')}`}
        severity="error"
        confirmLabel={i18nText('commonConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleForceEndConfirm}
        onCancel={() => setForceEndCourt(null)}
      />

      {/* Rename inventory court modal */}
      <ConfirmDialog
        isOpen={renameCourt !== null}
        title={terms.inventoryRename}
        message={i18nText('clubAdminRenameLabel')}
        severity="info"
        confirmLabel={i18nText('commonConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameCourt(null)}
      >
        <input
          data-testid="rename-input"
          type="text"
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-low px-3 py-2 text-sm"
          maxLength={100}
          autoFocus
        />
      </ConfirmDialog>

      {/* Archive court confirmation modal — no-delete copy */}
      <ConfirmDialog
        isOpen={archiveCourtTarget !== null}
        title={terms.inventoryArchive}
        message={terms.courtArchiveNoDelete}
        severity="warning"
        confirmLabel={i18nText('commonConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveCourtTarget(null)}
      />

      {/* Club admin notification modal */}
      <KioskNotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => {
          setIsNotificationModalOpen(false)
          setNotificationLoading(false)
          setNotificationError(null)
        }}
        onSubmit={handleSendNotification}
        isLoading={notificationLoading}
        error={notificationError}
        showGeneralToggle
        title={i18nText('notificationModalTitle')}
        typeLabel={i18nText('notificationTypeLabel')}
        typeInfoLabel={i18nText('notificationTypeInfo')}
        typeWarningLabel={i18nText('notificationTypeWarning')}
        typeErrorLabel={i18nText('notificationTypeError')}
        typeImportantLabel={i18nText('notificationTypeImportant')}
        messageLabel={i18nText('notificationMessageLabel')}
        messagePlaceholder={i18nText('notificationMessagePlaceholder')}
        durationLabel={i18nText('notificationDurationLabel')}
        cancelLabel={i18nText('commonCancel')}
        submitLabel={i18nText('notificationSend')}
        generalLabel={i18nText('notificationScopeGeneral')}
      />
    </div>
  )
}
