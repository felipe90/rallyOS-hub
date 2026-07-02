/**
 * ClubAdminPage — Admin dashboard for club mode
 *
 * Displays court list with CRUD operations, activation, and force-end.
 * Delegates all business logic to hooks.
 */

import { useState, useEffect } from 'react'
import { CLUB_STATUS } from '@shared/types'
import type { ClubCourtInfo } from '@shared/types'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Body, Headline } from '@/components/atoms/Typography'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { useToast } from '@/components/molecules/Toast'
import { useSocketContext } from '@/contexts/SocketContext'
import { useClubAdmin } from '@/hooks/useClubAdmin'
import { useClubCourtManagement } from '@/hooks/useClubCourtManagement'
import type { ClubOperationEvent } from '@/hooks/useClubCourtManagement'
import { useI18n } from '@/i18n'
import {
  Shield,
  Plus,
  Play,
  Trash2,
  LogOut,
  Building2,
  RefreshCw,
} from 'lucide-react'

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
  }
  return map[code] || code
}

/** Status-based badge colour */
function statusColor(status: ClubCourtInfo['status']): string {
  switch (status) {
    case CLUB_STATUS.AVAILABLE: return 'text-emerald-600'
    case CLUB_STATUS.RESERVED: return 'text-blue-600'
    case CLUB_STATUS.OCCUPIED: return 'text-amber-600'
    case CLUB_STATUS.FINISHED: return 'text-gray-500'
    case CLUB_STATUS.MAINTENANCE: return 'text-red-600'
    default: return 'text-text'
  }
}

export function ClubAdminPage() {
  const { socket, connected } = useSocketContext()
  const { i18nText } = useI18n()
  const { isAdmin, verifyAdminPin, verifyLoading, verifyError, clearVerifyError } =
    useClubAdmin(socket, connected)
  const courtMgmt = useClubCourtManagement(socket, connected)

  const { addToast } = useToast()
  const [adminPin, setAdminPin] = useState('')
  const [newCourtName, setNewCourtName] = useState('')
  const [forceEndCourt, setForceEndCourt] = useState<ClubCourtInfo | null>(null)

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
      case 'error':
        if (ev.code === 'ACTIVATION_FAILED') {
          addToast('error', i18nText('toastClubActivationFailed'))
        } else if (ev.code === 'FORCE_END_FAILED') {
          addToast('error', i18nText('toastClubForceEndFailed'))
        } else if (ev.code === 'DELETE_FAILED') {
          addToast('error', i18nText('toastClubDeleteFailed'))
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
    } else if (verifyError && verifyError !== 'VALIDATION_ERROR') {
      addToast('error', i18nText('errorClubPinInvalid'))
    }
  }, [verifyError, addToast, i18nText])

  useEffect(() => {
    clearVerifyError()
  }, [clearVerifyError])

  const handleVerify = () => {
    if (adminPin.trim()) {
      verifyAdminPin(adminPin.trim())
    }
  }

  const handleCreateCourt = () => {
    if (newCourtName.trim()) {
      courtMgmt.createCourt(newCourtName.trim())
      setNewCourtName('')
    }
  }

  const handleForceEndConfirm = () => {
    if (forceEndCourt) {
      courtMgmt.forceEndSession(forceEndCourt.id)
      setForceEndCourt(null)
    }
  }

  // Admin PIN verification screen
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-surface p-4">
        <div className="card bg-surface-low rounded-lg shadow-xl p-8 w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="bg-primary/10 text-primary p-3 rounded-full">
                <Shield size={32} />
              </div>
            </div>
            <Headline className="text-center">{i18nText('clubAdminTitle')}</Headline>
            <Body className="text-text/70">{i18nText('clubAdminEnterPin')}</Body>
          </div>

          <Input
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            placeholder="••••••"
            disabled={verifyLoading}
            error={translateVerifyError(verifyError, i18nText)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
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
        </div>
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
      />

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {/* Create court form */}
        <div className="card bg-surface-low rounded-lg shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            <Body className="font-medium">{i18nText('clubAdminCreateCourt')}</Body>
          </div>
          <div className="flex gap-2">
            <Input
              value={newCourtName}
              onChange={(e) => setNewCourtName(e.target.value)}
              placeholder={i18nText('clubAdminCourtNamePlaceholder')}
              disabled={courtMgmt.loading}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCourt() }}
            />
            <Button
              variant="primary"
              onClick={handleCreateCourt}
              loading={courtMgmt.loading}
              disabled={courtMgmt.loading || !newCourtName.trim()}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>

        {/* Court list */}
        {courtMgmt.courts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Building2 size={40} className="text-text/30" />
            <Body className="text-text/50 text-center">{i18nText('clubAdminNoCourts')}</Body>
          </div>
        ) : (
          <div className="space-y-2">
            {courtMgmt.courts.map((court) => (
              <div
                key={court.id}
                className="card bg-surface-low rounded-lg shadow-sm p-4 flex items-center justify-between hover:bg-surface-high transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <Body className="font-medium">{court.name}</Body>
                  <div className="flex gap-3 text-sm">
                    <span className={`font-medium ${statusColor(court.status)}`}>
                      {statusLabel(court.status, i18nText)}
                    </span>
                    {court.pin && (
                      <span className="font-mono text-text/50">
                        {i18nText('clubAdminPinLabel', { pin: court.pin })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
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
                        variant="danger"
                        size="xs"
                        onClick={() => courtMgmt.deleteCourt(court.id)}
                        disabled={courtMgmt.loading}
                      >
                        <Trash2 size={14} />
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refresh button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </Button>
        </div>

        {/* Errors are shown via Toast system via lastEvent */}
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
    </div>
  )
}
