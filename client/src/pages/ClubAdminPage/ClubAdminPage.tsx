/**
 * ClubAdminPage — Admin dashboard for club mode
 *
 * Displays court list with CRUD operations, activation, and force-end.
 * Delegates all business logic to hooks.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CLUB_STATUS } from '@shared/types'
import type { ClubCourtInfo } from '@shared/types'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Body, Title } from '@/components/atoms/Typography'
import { TabContainer } from '@/components/atoms/TabContainer'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { ClubSessionHistoryPanel } from '@/components/molecules/ClubSessionHistoryPanel'
import { useToast } from '@/components/molecules/Toast'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { useClubAdmin } from '@/hooks/useClubAdmin'
import { useClubCourtManagement } from '@/hooks/useClubCourtManagement'
import { useClubSessionHistory } from '@/hooks/useClubSessionHistory'
import type { ClubOperationEvent } from '@/hooks/useClubCourtManagement'
import { useI18n } from '@/i18n'
import { Routes } from '@/routes'
import {
  Shield,
  Plus,
  Play,
  Trash2,
  LogOut,
  Building2,
  RefreshCw,
  XCircle,
  ArrowLeft,
  Monitor,
  Trophy,
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

/** Status-based badge colour and border */
function statusColor(status: ClubCourtInfo['status']): string {
  switch (status) {
    case CLUB_STATUS.AVAILABLE: return 'text-emerald-600 border-l-emerald-500'
    case CLUB_STATUS.RESERVED: return 'text-blue-600 border-l-blue-500'
    case CLUB_STATUS.OCCUPIED: return 'text-amber-600 border-l-amber-500'
    case CLUB_STATUS.FINISHED: return 'text-gray-500 border-l-gray-400'
    case CLUB_STATUS.MAINTENANCE: return 'text-red-600 border-l-red-500'
    default: return 'text-text border-l-transparent'
  }
}

export function ClubAdminPage() {
  const { socket, connected } = useSocketContext()
  const navigate = useNavigate()
  const { i18nText } = useI18n()
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
  const [adminPin, setAdminPin] = useState('')
  const [forceEndCourt, setForceEndCourt] = useState<ClubCourtInfo | null>(null)
  const [deleteCourtTarget, setDeleteCourtTarget] = useState<ClubCourtInfo | null>(null)

  // Toast for operation events
  useEffect(() => {
    if (!courtMgmt.lastEvent) return

    const ev: ClubOperationEvent = courtMgmt.lastEvent
    switch (ev.type) {
      case 'court-created':
        addToast('success', i18nText('toastClubCourtCreated'))
        break
      case 'court-activated':
        addToast('success', i18nText('toastClubCourtActivated'))
        break
      case 'session-ended':
        addToast('success', i18nText('toastClubSessionEnded'))
        break
      case 'court-deleted':
        addToast('success', i18nText('toastClubCourtDeleted'))
        break
      case 'court-deactivated':
        addToast('success', i18nText('toastClubCourtDeactivated'))
        break
      case 'court-resetted':
        addToast('success', i18nText('toastClubCourtResetted'))
        break
      case 'error':
        if (ev.code === 'ACTIVATION_FAILED') {
          addToast('error', i18nText('toastClubActivationFailed'))
        } else if (ev.code === 'FORCE_END_FAILED') {
          addToast('error', i18nText('toastClubForceEndFailed'))
        } else if (ev.code === 'DELETE_FAILED') {
          addToast('error', i18nText('toastClubDeleteFailed'))
        } else if (ev.code === 'DEACTIVATE_FAILED') {
          addToast('error', i18nText('toastClubDeactivateFailed'))
        } else if (ev.code === 'RESET_FAILED') {
          addToast('error', i18nText('toastClubResetFailed'))
        }
        break
    }

    courtMgmt.clearEvent()
  }, [courtMgmt.lastEvent, courtMgmt.clearEvent, addToast, i18nText])

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

  const handleCreateCourt = () => {
    let nextNumber = courtMgmt.courts.length + 1
    let defaultName = i18nText('clubAdminDefaultCourtName', { number: String(nextNumber) })
    
    // Prevent naming collisions
    while (courtMgmt.courts.some(c => c.name === defaultName)) {
      nextNumber++
      defaultName = i18nText('clubAdminDefaultCourtName', { number: String(nextNumber) })
    }
    
    courtMgmt.createCourt(defaultName)
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

  // Admin PIN verification screen
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-surface p-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-surface-low rounded-lg shadow-xl p-8 w-full max-w-sm space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="bg-primary/10 text-primary p-3 rounded-full">
                <Shield size={32} />
              </div>
            </div>
            <Title className="text-center">{i18nText('clubAdminTitle')}</Title>
            <Body className="text-text/70">{i18nText('clubAdminEnterPin')}</Body>
          </div>

          <Input
            type="password"
            value={adminPin}
            onChange={(e) => { setAdminPin(e.target.value); clearVerifyError() }}
            placeholder="••••••"
            disabled={verifyLoading}
            error={translateVerifyError(verifyError, i18nText)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
            autoFocus
          />

          <div className="space-y-3">
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
            >
              {i18nText('commonBack')}
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Admin dashboard
  return (
    <div className="flex flex-col h-dvh bg-surface">
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => window.open(Routes.KIOSK_CLUB, '_blank')} title="Abrir Kiosk Club">
              <Monitor size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(Routes.KIOSK_TOURNAMENT, '_blank')} title="Abrir Kiosk Torneo">
              <Trophy size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(Routes.AUTH)}>
              <ArrowLeft size={16} className="mr-1" />
              {i18nText('clubAdminBack')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-4 space-y-4">
        <TabContainer
          tabs={[
            {
              id: 'courts',
              label: i18nText('clubAdminTabCourts'),
              content: (
                <div className="space-y-4">
                  {/* Create court area */}
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      className="w-full border-dashed border-2 py-6 text-text/70 hover:text-primary hover:border-primary/50"
                      onClick={handleCreateCourt}
                      disabled={courtMgmt.loading}
                      loading={courtMgmt.loading}
                    >
                      <Plus size={18} className="mr-2" />
                      {i18nText('clubAdminCreateCourt')}
                    </Button>
                  </div>

                  {/* Court list */}
                  {courtMgmt.courts.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 gap-2"
                    >
                      <Building2 size={40} className="text-text/30" />
                      <Body className="text-text/50 text-center">{i18nText('clubAdminNoCourts')}</Body>
                    </motion.div>
                  ) : (
                    <motion.div layout className="space-y-2">
                      <AnimatePresence>
                        {courtMgmt.courts.map((court) => (
                          <motion.div
                            layout
                            key={court.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={`card bg-surface-low rounded-lg shadow-sm p-4 flex items-center justify-between border-l-4 ${statusColor(court.status).split(' ')[1]} transition-colors relative overflow-hidden`}
                          >
                            <div className="flex flex-col gap-1 z-10">
                              <Body className="font-medium">{court.name}</Body>
                              <div className="flex items-center gap-3 text-sm">
                                <span className={`font-medium ${statusColor(court.status).split(' ')[0]}`}>
                                  {statusLabel(court.status, i18nText)}
                                </span>
                                {court.pin && (
                                  <span className="font-mono font-bold bg-surface-high px-2 py-0.5 rounded text-xs text-text">
                                    {i18nText('clubAdminPinLabel', { pin: court.pin })}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 z-10">
                              {court.status === CLUB_STATUS.AVAILABLE && (
                                <>
                                  <Button
                                    variant="success"
                                    size="xs"
                                    onClick={() => courtMgmt.activateCourt(court.id)}
                                    disabled={courtMgmt.loading}
                                  >
                                    <Play size={14} className="mr-1" />
                                    {i18nText('clubAdminActivate')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => setDeleteCourtTarget(court)}
                                    disabled={courtMgmt.loading}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </>
                              )}
                              {court.status === CLUB_STATUS.RESERVED && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => courtMgmt.deactivateCourt(court.id)}
                                    disabled={courtMgmt.loading}
                                  >
                                    <XCircle size={14} className="mr-1" />
                                    {i18nText('clubAdminDeactivate')}
                                  </Button>
                                </>
                              )}
                              {court.status === CLUB_STATUS.OCCUPIED && (
                                <Button
                                  variant="danger"
                                  size="xs"
                                  onClick={() => setForceEndCourt(court)}
                                  disabled={courtMgmt.loading}
                                >
                                  <LogOut size={14} className="mr-1" />
                                  {i18nText('clubAdminForceEnd')}
                                </Button>
                              )}
                              {court.status === CLUB_STATUS.FINISHED && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => courtMgmt.resetCourt(court.id)}
                                    disabled={courtMgmt.loading}
                                  >
                                    <RefreshCw size={14} className="mr-1" />
                                    {i18nText('clubAdminReset')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => setDeleteCourtTarget(court)}
                                    disabled={courtMgmt.loading}
                                  >
                                    <Trash2 size={14} />
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
              ),
            },
            {
              id: 'history',
              label: i18nText('clubAdminTabHistory'),
              content: (
                <ClubSessionHistoryPanel
                  history={sessionHistory}
                  clubConfigured={true}
                />
              ),
            },
          ]}
        />
      </main>

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
        message={i18nText('clubAdminDeleteConfirm')}
        severity="error"
        confirmLabel={i18nText('clubAdminDelete')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteCourtTarget(null)}
      />
    </div>
  )
}
