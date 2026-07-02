/**
 * ClubAdminPage - Admin dashboard for club mode
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
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { useSocketContext } from '@/contexts/SocketContext'
import { useClubAdmin } from '@/hooks/useClubAdmin'
import { useClubCourtManagement } from '@/hooks/useClubCourtManagement'

/** Human-readable label for club status */
function statusLabel(status: ClubCourtInfo['status']): string {
  switch (status) {
    case CLUB_STATUS.AVAILABLE: return 'Available'
    case CLUB_STATUS.RESERVED: return 'Reserved'
    case CLUB_STATUS.OCCUPIED: return 'Occupied'
    case CLUB_STATUS.FINISHED: return 'Finished'
    case CLUB_STATUS.MAINTENANCE: return 'Maintenance'
    default: return status
  }
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
  const { isAdmin, verifyAdminPin, verifyLoading, verifyError, clearVerifyError } =
    useClubAdmin(socket, connected)
  const courtMgmt = useClubCourtManagement(socket, connected)

  const [adminPin, setAdminPin] = useState('')
  const [newCourtName, setNewCourtName] = useState('')
  const [forceEndCourt, setForceEndCourt] = useState<ClubCourtInfo | null>(null)

  // Auto-verify if PIN already known
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
      <div className="flex flex-col items-center justify-center min-h-dvh p-4 bg-surface">
        <div className="w-full max-w-sm card bg-background rounded-lg shadow-xl p-6 space-y-4">
          <Headline className="text-center">Club Admin</Headline>
          <Input
            label="Admin PIN"
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            placeholder="Enter admin PIN"
            disabled={verifyLoading}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
          />
          {verifyError && (
            <Body className="text-red-500 text-sm text-center">{verifyError}</Body>
          )}
          <Button
            variant="primary"
            fullWidth
            onClick={handleVerify}
            loading={verifyLoading}
            disabled={verifyLoading || !adminPin.trim()}
          >
            Verify
          </Button>
        </div>
      </div>
    )
  }

  // Admin dashboard
  return (
    <div className="flex flex-col h-dvh bg-surface">
      <header className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Headline>Club Admin</Headline>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {/* Create court form */}
        <div className="card bg-background rounded-lg shadow p-4 space-y-3">
          <Body className="font-medium">Create Court</Body>
          <div className="flex gap-2">
            <Input
              value={newCourtName}
              onChange={(e) => setNewCourtName(e.target.value)}
              placeholder="Court name"
              disabled={courtMgmt.loading}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCourt() }}
            />
            <Button
              variant="primary"
              onClick={handleCreateCourt}
              loading={courtMgmt.loading}
              disabled={courtMgmt.loading || !newCourtName.trim()}
            >
              Create
            </Button>
          </div>
        </div>

        {/* Court list */}
        {courtMgmt.courts.length === 0 ? (
          <Body className="text-center text-text/50">No courts yet. Create one above.</Body>
        ) : (
          <div className="space-y-2">
            {courtMgmt.courts.map((court) => (
              <div
                key={court.id}
                className="card bg-background rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div className="flex flex-col gap-1">
                  <Body className="font-medium">{court.name}</Body>
                  <div className="flex gap-3 text-sm">
                    <span className={statusColor(court.status)}>{statusLabel(court.status)}</span>
                    {court.pin && <span className="text-text/50">PIN: {court.pin}</span>}
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
                        Activate
                      </Button>
                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => courtMgmt.deleteCourt(court.id)}
                        disabled={courtMgmt.loading}
                      >
                        Delete
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
                      Force End
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {courtMgmt.error && (
          <Body className="text-red-500 text-sm text-center">{courtMgmt.error}</Body>
        )}
      </main>

      {/* Force-end confirmation modal */}
      <ConfirmDialog
        isOpen={forceEndCourt !== null}
        title="Force End Session"
        message={`Are you sure you want to force end the session on "${forceEndCourt?.name}"? This will end the current game and invalidate the court PIN.`}
        severity="error"
        confirmLabel="Force End"
        cancelLabel="Cancel"
        onConfirm={handleForceEndConfirm}
        onCancel={() => setForceEndCourt(null)}
      />
    </div>
  )
}
