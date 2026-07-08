/**
 * Owner Dashboard Page
 * Full admin dashboard with table creation, PIN management, and QR codes
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PinModal } from '@/components/molecules/PinModal'
import { KioskNotificationModal } from '@/components/molecules/KioskNotificationModal'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { useSocketContext } from '@/contexts/SocketContext'
import logoImg from '@/assets/logo-big.png'
import { useAuthContext } from '@/contexts/AuthContext'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { usePinSubmission } from '@/hooks/usePinSubmission'
import { useRefereeSession } from '@/hooks/useRefereeSession'
import { useCourtManagement } from '@/hooks/useCourtManagement'
import { useToast } from '@/components/molecules/Toast'
import { Button } from '@/components/atoms/Button'
import { Body } from '@/components/atoms/Typography'
import { SocketEvents } from '@shared/events'
import { Routes, buildScoreboardRoute } from '@/routes'
import type { TableInfoWithPin, KioskNotificationType } from '@shared/types'
import { Plus, FileText, Table2, Swords, Users, Bell, Flag, Download, AlertTriangle } from 'lucide-react'


export interface OwnerDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function OwnerDashboardPage({ viewMode: initialViewMode }: OwnerDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [exportCsvChecked, setExportCsvChecked] = useState(true)
  const [selectedCourt, setSelectedCourt] = useState<TableInfoWithPin | null>(null)
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { courts, connected, socket, requestCourtsWithPins, appError } = useSocketContext()
  const { logout, ownerPin, setCourtPin, isOwner, tournamentToken } = useAuthContext()
  const stats = useDashboardStats(courts)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)
  const { saveSession, findAnyValidSession, clearSession } = useRefereeSession()

  const courtMgmt = useCourtManagement({ socket, connected })
  const { addToast } = useToast()

  // Track previous creating state to detect court creation completion
  const wasCreatingRef = useRef(courtMgmt.isCreating)
  useEffect(() => {
    const wasCreating = wasCreatingRef.current;
    wasCreatingRef.current = courtMgmt.isCreating;
    // Transition: was creating → now not creating = court created successfully
    if (wasCreating && !courtMgmt.isCreating && !appError) {
      addToast('success', i18nText('toastCourtCreated'));
    }
  }, [courtMgmt.isCreating, appError, addToast, i18nText]);

  // Toast on PIN error
  useEffect(() => {
    if (pinError) {
      addToast('error', i18nText('toastPinError'));
    }
  }, [pinError, addToast, i18nText]);

  // Derived: check if any FINISHED courts exist
  const hasFinishedCourts = courts.some(t => t.status === 'FINISHED')
  const hasCourts = courts.length > 0

  // Owner always gets courts with PINs
  useEffect(() => {
    if (!connected) return
    requestCourtsWithPins(ownerPin || '')
  }, [connected, ownerPin, requestCourtsWithPins])

  // Auto-restore valid referee session on first visit only
  useEffect(() => {
    if (!connected || courts.length === 0) return
    const alreadyRestored = sessionStorage.getItem('rallyos-owner-restored')
    if (alreadyRestored) return
    const session = findAnyValidSession(courts)
    if (session) {
      sessionStorage.setItem('rallyos-owner-restored', '1')
      setCourtPin(session.pin)
      navigate(buildScoreboardRoute(session.tableId, 'referee'))
    } else {
      sessionStorage.removeItem('rallyos-owner-restored')
    }
  }, [connected, courts, findAnyValidSession, setCourtPin, navigate])

  // Clear sessions for courts that transition to FINISHED
  useEffect(() => {
    for (const court of courts) {
      if (court.status === 'FINISHED') {
        clearSession(court.id)
      }
    }
  }, [courts, clearSession])

  // Listen for QR_DATA and PIN_REGENERATED events
  useEffect(() => {
    if (!socket) return

    const handleQRData = () => {
      // QR generated client-side from court data — server event is informational
    }

    const handlePinRegenerated = () => {
      requestCourtsWithPins(ownerPin || '')
    }

    socket.on(SocketEvents.SERVER.QR_DATA, handleQRData)
    socket.on(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)

    return () => {
      socket.off(SocketEvents.SERVER.QR_DATA, handleQRData)
      socket.off(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)
    }
  }, [socket, ownerPin, requestCourtsWithPins])

  /** ── PIN Modal ── */
  const handleCourtClick = (courtId: string) => {
    const court = courts.find(t => t.id === courtId)
    if (court) {
      setSelectedCourt(court as TableInfoWithPin)
      setPinModalOpen(true)
      clearError()
    }
  }

  const handlePinSubmit = async (pin: string) => {
    if (!selectedCourt) return
    setCourtPin(pin)
    const result = await submitPin(pin, selectedCourt.id)
    if (result.success) {
      saveSession(selectedCourt.id, pin)
      navigate(buildScoreboardRoute(selectedCourt.id, 'referee'))
    }
  }

  const handlePinClose = () => {
    setPinModalOpen(false)
    setSelectedCourt(null)
    clearError()
  }

  /** ── Featured Court Toggle ── */
  const handleToggleFeatured = useCallback((courtId: string) => {
    if (!socket) return
    const court = courts.find(t => t.id === courtId)
    const isCurrentlyFeatured = court?.featured === true
    socket.emit(SocketEvents.CLIENT.SET_FEATURED, {
      targetCourtId: isCurrentlyFeatured ? null : courtId,
    })
  }, [socket, courts])

  /** ── Notification Modal ── */
  const handleNotificationSubmit = ({ type, message, duration }: { type: KioskNotificationType; message: string; duration: number }) => {
    if (!socket || !ownerPin) return
    socket.emit(SocketEvents.CLIENT.SEND_NOTIFICATION, {
      pin: ownerPin,
      type,
      message,
      duration,
    })
    setNotifModalOpen(false)
  }

  const handleNotificationClose = () => {
    setNotifModalOpen(false)
  }

  /** ── Export CSV (authenticated fetch + blob download) ── */
  const downloadCsv = useCallback(async () => {
    const token = tournamentToken
    if (!token) return

    try {
      const res = await fetch('/api/export/matches.csv', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rallyos-matches.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast('error', i18nText('toastErrorGeneric') || 'Export failed')
    }
  }, [tournamentToken, addToast, i18nText])

  /** ── Finish Tournament ── */
  const handleFinishConfirm = useCallback(async () => {
    setFinishDialogOpen(false)

    // If CSV export is checked, download CSV first
    if (exportCsvChecked) {
      await downloadCsv()
    }

    // Call the finish endpoint
    const token = tournamentToken
    if (token) {
      try {
        await fetch('/api/tournament/finish', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        addToast('success', i18nText('tournamentFinishSuccess'))
      } catch {
        // Server may be slow — proceed anyway
      }
    }

    // Reset CSV checkbox for next time
    setExportCsvChecked(true)
  }, [exportCsvChecked, tournamentToken, downloadCsv, addToast, i18nText])

  /** Translate error codes from usePinSubmission to human-readable messages */
  const translatePinError = (code: string | null): string | null => {
    if (!code) return null
    const map: Record<string, string> = {
      NO_CONNECTION: i18nText('errorPinNoConnection'),
      INVALID_PIN: i18nText('errorPinInvalid'),
      REF_ASSIGN_FAILED: i18nText('errorPinAssignFailed'),
      TIMEOUT: i18nText('errorPinTimeout'),
      DISCONNECTED: i18nText('errorPinDisconnected'),
    }
    return map[code] || code
  }

  const handleOneClickCreate = () => {
    if (courtMgmt.isCreating) return;
    
    // Auto-calculate the next sequential court number
    let nextNum = 1;
    let newName = i18nText('clubAdminDefaultCourtName', { number: String(nextNum) });
    
    while (courts.some(c => c.name === newName)) {
      nextNum++;
      newName = i18nText('clubAdminDefaultCourtName', { number: String(nextNum) });
    }
    
    courtMgmt.setCourtName(newName);
    courtMgmt.createCourt();
  };

  const dashboardActions = <div className="flex flex-wrap gap-2 items-center">
    {!courtMgmt.isCreating ? (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNotifModalOpen(true)}
          icon={<Bell size={18} />}
        >
          {i18nText('ownerCreateNotification')}
        </Button>
            <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(Routes.HISTORY)}
          icon={<FileText size={18} />}
        >
          {i18nText('ownerViewHistory')}
        </Button>
        {/* Export CSV button — only for owners when FINISHED courts exist */}
        {isOwner && hasFinishedCourts && (
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadCsv}
            icon={<Download size={18} />}
          >
            {i18nText('exportCsv')}
          </Button>
        )}
        {/* End Tournament button — only for owners when courts exist */}
        {isOwner && hasCourts && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setFinishDialogOpen(true)}
            icon={<Flag size={18} />}
          >
            {i18nText('finishTournament')}
          </Button>
        )}
      </>
    ) : (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-low rounded border border-border">
          <span className="text-sm text-primary font-medium whitespace-nowrap animate-pulse">
            {i18nText('ownerCreating')}
          </span>
        </div>
        {appError && (
          <div role="alert" className="flex items-center gap-2 mt-1">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-red-500 text-sm">{appError}</p>
          </div>
        )}
      </div>
    )}
  </div>

  return (
    <div className="flex flex-col h-dvh bg-surface ">
      <PageHeader
        title={i18nText('ownerTitle')}
        subtitle={i18nText('ownerSubtitle')}
        logo={logoImg}
        showStatus={true}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <Button variant="ghost" onClick={() => { sessionStorage.removeItem('rallyos-owner-restored'); logout(); navigate(Routes.AUTH) }} size="sm">
            {i18nText('commonBack')}
          </Button>
        }
      />

      <main id="main-content" className="flex-1 overflow-auto bg-primary/10">
        <div className="p-4 space-y-4">
          {/* Create court — big dashed button like ClubAdmin */}
          {!courtMgmt.isCreating && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="w-full border-dashed border-2 py-6 text-text/70 hover:text-primary hover:border-primary/50"
                onClick={handleOneClickCreate}
                disabled={courtMgmt.isCreating}
                loading={courtMgmt.isCreating}
              >
                <Plus size={18} className="mr-2" />
                {i18nText('ownerCreateCourt')}
              </Button>
            </div>
          )}
          <DashboardHeader
            totalTables={stats.totalTables}
            liveMatches={stats.liveMatches}
            activePlayers={stats.activePlayers}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            actions={dashboardActions}
            statIcons={{
              canchas: <Table2 className="text-blue-500" size={28} />,
              partidos: <Swords className="text-amber-500" size={28} />,
              jugadores: <Users className="text-emerald-500" size={28} />,
            }}
            statLabels={{
              courts: i18nText('dashboardStatCourts'),
              matches: i18nText('dashboardStatMatches'),
              players: i18nText('dashboardStatPlayers'),
            }}
            gridViewLabel={i18nText('dashboardGridView')}
            listViewLabel={i18nText('dashboardListView')}
          />
          <DashboardGrid
            courts={courts}
            onCourtClick={handleCourtClick}
            viewMode={viewMode}
            showPin={true}
            showQr={true}
            onCleanCourt={courtMgmt.requestClean}
            cleanConfirmCourtId={courtMgmt.cleanConfirmCourtId}
            onCleanCourtConfirm={() => {
              courtMgmt.confirmClean();
              requestCourtsWithPins(ownerPin || '');
              addToast('success', i18nText('toastCourtCleaned'));
            }}
            onCleanCourtCancel={courtMgmt.cancelClean}
            onDeleteCourt={courtMgmt.requestDelete}
            showDeleteConfirm={courtMgmt.deleteConfirmCourtId}
            onDeleteCourtConfirm={() => {
              courtMgmt.confirmDelete();
              addToast('success', i18nText('toastCourtDeleted'));
            }}
            onDeleteCourtCancel={courtMgmt.cancelDelete}
            featuredCourtId={courts.find(t => t.featured)?.id ?? null}
            onToggleFeatured={handleToggleFeatured}
          />
        </div>
      </main>

      <PinModal
        isOpen={pinModalOpen}
        tableName={selectedCourt?.name || ''}
        onClose={handlePinClose}
        onSubmit={handlePinSubmit}
        isLoading={pinLoading}
        error={translatePinError(pinError)}
      />

      <KioskNotificationModal
        isOpen={notifModalOpen}
        onClose={handleNotificationClose}
        onSubmit={handleNotificationSubmit}
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
      />

      {/* Finish Tournament Confirmation Dialog */}
      <ConfirmDialog
        isOpen={finishDialogOpen}
        title={i18nText('finishTournament')}
        message={i18nText('finishTournamentConfirm')}
        severity="error"
        confirmLabel={i18nText('finishTournament')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={handleFinishConfirm}
        onCancel={() => setFinishDialogOpen(false)}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={exportCsvChecked}
            onChange={(e) => setExportCsvChecked(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <Body>{i18nText('finishTournamentExportCsv')}</Body>
        </label>
      </ConfirmDialog>
    </div>
  )
}
