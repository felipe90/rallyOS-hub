/**
 * ClubAdminPage — Admin dashboard for club mode
 *
 * Displays court list with CRUD operations, activation, and force-end.
 * Delegates all business logic to hooks.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CLUB_STATUS } from '@shared/types'
import type { ClubCourtInfo, KioskNotificationType, SessionMode } from '@shared/types'
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
import { useClubCourtManagement } from '@/hooks/useClubCourtManagement'
import { useClubSessionHistory } from '@/hooks/useClubSessionHistory'
import type { ClubOperationEvent } from '@/hooks/useClubCourtManagement'
import { useSportTerms } from '@/hooks/useSportTerms'
import { Routes } from '@/routes'
import logoBig from '@/assets/logo-big.png'
import {
  Play,
  Trash2,
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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/** Human-readable label for club status */
function statusLabel(status: ClubCourtInfo['status'], i18nText: (key: string) => string): string {
  switch (status) {
    case CLUB_STATUS.AVAILABLE: return i18nText('clubAdminStatusAvailable')
    case CLUB_STATUS.RESERVED: return i18nText('clubAdminStatusReserved')
    case CLUB_STATUS.OCCUPIED: return i18nText('clubAdminStatusOccupied')
    case CLUB_STATUS.FINISHED: return i18nText('clubAdminStatusFinished')
    case CLUB_STATUS.MAINTENANCE: return i18nText('clubAdminStatusMaintenance')
    default: return status
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

/** Status-based pill class — matches the Badge atom design from tournament cards */
function statusPillClass(status: ClubCourtInfo['status']): string {
  switch (status) {
    case CLUB_STATUS.AVAILABLE: return 'bg-emerald-500/10 text-emerald-600'
    case CLUB_STATUS.RESERVED: return 'bg-blue-500/10 text-blue-600'
    case CLUB_STATUS.OCCUPIED: return 'bg-amber-500/10 text-amber-600'
    case CLUB_STATUS.FINISHED: return 'bg-gray-500/10 text-gray-500'
    case CLUB_STATUS.MAINTENANCE: return 'bg-red-500/10 text-red-600'
    default: return 'bg-surface-low text-text'
  }
}

/** Status-based border colour */
function statusBorderClass(status: ClubCourtInfo['status']): string {
  switch (status) {
    case CLUB_STATUS.AVAILABLE: return 'border-l-emerald-500'
    case CLUB_STATUS.RESERVED: return 'border-l-blue-500'
    case CLUB_STATUS.OCCUPIED: return 'border-l-amber-500'
    case CLUB_STATUS.FINISHED: return 'border-l-gray-400'
    case CLUB_STATUS.MAINTENANCE: return 'border-l-red-500'
    default: return 'border-l-transparent'
  }
}

export function ClubAdminPage() {
  const { socket, connected } = useSocketContext()
  const navigate = useNavigate()
  const { terms, i18nText, sport } = useSportTerms()
  const { setSessionToken } = useAuthContext()
  const { isAdmin, verifyAdminPin, verifyLoading, verifyError, clearVerifyError } =
    useClubAdmin(socket, connected, { setSessionToken })
  const courtMgmt = useClubCourtManagement(socket, connected)
  // Session history hook is only meaningful once the admin is verified
  // (the server only emits CLUB_SESSION_HISTORY to authenticated sockets).
  // The hook tolerates a null socket and connected=false without crashing,
  // so we always call it to keep React hook order stable.
  const sessionHistory = useClubSessionHistory(socket, connected)

  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('courts')
  const [adminPin, setAdminPin] = useState('')
  const [forceEndCourt, setForceEndCourt] = useState<ClubCourtInfo | null>(null)
  const [deleteCourtTarget, setDeleteCourtTarget] = useState<ClubCourtInfo | null>(null)
  const [kioskMode, setKioskModeState] = useState<'club' | 'tournament'>('club')
  const [occupyCourt, setOccupyCourt] = useState<ClubCourtInfo | null>(null)
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)

  // Toast for operation events
  useEffect(() => {
    if (!courtMgmt.lastEvent) return

    const ev: ClubOperationEvent = courtMgmt.lastEvent
    switch (ev.type) {
      case 'court-created':
        addToast('success', terms.toastClubCourtCreated)
        break
      case 'court-activated':
        addToast('success', terms.toastClubCourtActivated)
        break
      case 'court-occupied':
        addToast('success', i18nText('toastClubCourtOccupied'))
        break
      case 'session-ended':
        addToast('success', i18nText('toastClubSessionEnded'))
        break
      case 'court-deleted':
        addToast('success', terms.toastClubCourtDeleted)
        break
      case 'court-deactivated':
        addToast('success', terms.toastClubCourtDeactivated)
        break
      case 'court-resetted':
        addToast('success', terms.toastClubCourtResetted)
        break
      case 'error':
        if (ev.code === 'ACTIVATION_FAILED') {
          addToast('error', i18nText('toastClubActivationFailed'))
        } else if (ev.code === 'FORCE_END_FAILED') {
          addToast('error', i18nText('toastClubForceEndFailed'))
        } else if (ev.code === 'DELETE_FAILED') {
          addToast('error', terms.toastClubDeleteFailed)
        } else if (ev.code === 'DEACTIVATE_FAILED') {
          addToast('error', i18nText('toastClubDeactivateFailed'))
        } else if (ev.code === 'RESET_FAILED') {
          addToast('error', terms.toastClubResetFailed)
        }
        break
    }

    courtMgmt.clearEvent()
  }, [courtMgmt.lastEvent, courtMgmt.clearEvent, addToast, i18nText])

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

  const handleCreateCourt = (name: string) => {
    courtMgmt.createCourt(name)
  }

  const handleForceEndConfirm = () => {
    if (forceEndCourt) {
      courtMgmt.forceEndSession(forceEndCourt.id)
      setForceEndCourt(null)
    }
  }

  const handleDeleteConfirm = () => {
    if (deleteCourtTarget) {
      courtMgmt.deleteCourt(deleteCourtTarget.id)
      setDeleteCourtTarget(null)
    }
  }

  const handleOccupySubmit = useCallback(
    (playerName: string, phone: string, mode: SessionMode) => {
      if (!occupyCourt) return
      courtMgmt.adminOccupyCourt(occupyCourt.id, playerName, phone, mode)
      setOccupyCourt(null)
    },
    [occupyCourt, courtMgmt],
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
            onComplete={() => {}} // Auto-submit disabled — user must click button
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
              {courtMgmt.courts.length === 0 ? (
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
                    {courtMgmt.courts.map((court) => (
                      <motion.div
                        layout
                        key={court.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`card-light flex flex-col gap-2 p-4 border-l-4 ${statusBorderClass(court.status)} transition-colors relative`}
                      >
                        {/* Title row: court name + PIN badge + status pill */}
                        <div className="flex items-center justify-between gap-2">
                          <Body className="font-medium truncate">{court.name}</Body>
                          <div className="flex items-center gap-2">
                            {court.pin && (
                              <Badge className="bg-primary/10 text-primary font-mono font-bold tracking-wider">
                                PIN {court.pin}
                              </Badge>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide shrink-0 ${statusPillClass(court.status)}`}>
                              {court.status === CLUB_STATUS.OCCUPIED && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                </span>
                              )}
                              {statusLabel(court.status, i18nText)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons stacked below */}
                        <div className="flex flex-col gap-2 mt-2">
                          {court.status === CLUB_STATUS.AVAILABLE && (
                            <>
                              <Button variant="primary" size="xs" fullWidth onClick={() => courtMgmt.activateCourt(court.id)} disabled={courtMgmt.loading} icon={<Play size={14} />}>
                                {i18nText('clubAdminActivate')}
                              </Button>
                              <Button variant="outline" size="xs" fullWidth onClick={() => setOccupyCourt(court)} disabled={courtMgmt.loading} icon={<UserPlus size={14} />}>
                                {i18nText('clubAdminOccupy')}
                              </Button>
                              <Button variant="secondary" size="xs" fullWidth onClick={() => setDeleteCourtTarget(court)} disabled={courtMgmt.loading} icon={<Trash2 size={14} />}>
                                {i18nText('clubAdminDelete')}
                              </Button>
                            </>
                          )}
                          {court.status === CLUB_STATUS.RESERVED && (
                            <>
                              <Button variant="primary" size="xs" fullWidth onClick={() => setOccupyCourt(court)} disabled={courtMgmt.loading} icon={<UserPlus size={14} />}>
                                {i18nText('clubAdminOccupy')}
                              </Button>
                              <Button variant="ghost" size="xs" fullWidth onClick={() => courtMgmt.deactivateCourt(court.id)} disabled={courtMgmt.loading} icon={<XCircle size={14} />}>
                                {i18nText('clubAdminDeactivate')}
                              </Button>
                            </>
                          )}
                          {court.status === CLUB_STATUS.OCCUPIED && (
                            <>
                              <Button variant="danger" size="xs" fullWidth onClick={() => setForceEndCourt(court)} disabled={courtMgmt.loading} icon={<LogOut size={14} />}>
                                {i18nText('clubAdminForceEnd')}
                              </Button>
                              {court.sessionMode && court.sessionMode !== 'free' && (
                                <Button variant={court.featured ? 'primary' : 'secondary'} size="xs" fullWidth onClick={() => courtMgmt.toggleFeatured(court.id)} disabled={courtMgmt.loading} icon={<Star size={14} className={court.featured ? 'fill-amber-400 text-amber-400' : ''} />}>
                                  {court.featured ? i18nText('courtQuitarDestacado') : i18nText('courtDestacar')}
                                </Button>
                              )}
                            </>
                          )}
                          {court.status === CLUB_STATUS.FINISHED && (
                            <>
                              <Button variant="primary" size="xs" fullWidth onClick={() => courtMgmt.resetCourt(court.id)} disabled={courtMgmt.loading} icon={<RefreshCw size={14} />}>
                                {i18nText('clubAdminReset')}
                              </Button>
                              <Button variant="secondary" size="xs" fullWidth onClick={() => setDeleteCourtTarget(court)} disabled={courtMgmt.loading} icon={<Trash2 size={14} />}>
                                {i18nText('clubAdminDelete')}
                              </Button>
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

      {/* Floating Action Button — Nueva Cancha (solo en tab Canchas) */}
      {activeTab === 'courts' && (
      <div className="fixed bottom-6 right-6 z-50">
        <FloatingActionButton
          icon={<Plus size={20} />}
          label={terms.clubAdminCreateCourt}
          onClick={() => handleCreateCourt(
            (() => {
              let next = courtMgmt.courts.length + 1
              let name = i18nText(`sportTerm.clubAdminDefaultCourtName.${sport}`, { number: String(next) })
              while (courtMgmt.courts.some(c => c.name === name)) {
                next++
                name = i18nText(`sportTerm.clubAdminDefaultCourtName.${sport}`, { number: String(next) })
              }
              return name
            })()
          )}
          disabled={courtMgmt.loading}
          loading={courtMgmt.loading}
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
        confirmLabel={i18nText('clubAdminForceEnd')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleForceEndConfirm}
        onCancel={() => setForceEndCourt(null)}
      />

      {/* Delete court confirmation modal */}
      <ConfirmDialog
        isOpen={deleteCourtTarget !== null}
        title={i18nText('clubAdminDelete')}
        message={terms.clubAdminDeleteConfirm}
        severity="error"
        confirmLabel={i18nText('clubAdminDelete')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteCourtTarget(null)}
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
