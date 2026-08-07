/**
 * Owner Dashboard Page
 * Full admin dashboard with table creation, PIN management, and QR codes
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSportTerms } from '@/hooks/useSportTerms'
import { DashboardGrid, DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PinModal } from '@/components/molecules/PinModal'
import { KioskNotificationModal } from '@/components/molecules/KioskNotificationModal'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { HistoryAccordion } from '@/components/molecules/HistoryAccordion'
import { Tab } from '@/components/atoms/Tab'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { usePinSubmission } from '@/hooks/usePinSubmission'
import { useRefereeSession } from '@/hooks/useRefereeSession'
import { useCourtInventory } from '@/hooks/useCourtInventory'
import { useBracket } from '@/hooks/useBracket'
import { BracketView } from '@/components/organisms'
import { useToast } from '@/components/molecules/Toast'
import { Button } from '@/components/atoms'
import { Body, Typography } from '@/components/atoms/Typography'
import { SocketEvents } from '@shared/events'
import { Routes, buildScoreboardRoute } from '@/routes'
import { INVENTORY_STATUS, type CourtInfoWithPin, type KioskNotificationType, type CourtInfo, type KioskMode } from '@shared/types'
import { ArrowLeft, Table2, Swords, Users, Bell, Flag, Download, AlertTriangle, Clock, Trophy, Monitor, ListTree } from 'lucide-react'


export interface OwnerDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function OwnerDashboardPage({ viewMode: initialViewMode }: OwnerDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [exportCsvChecked, setExportCsvChecked] = useState(true)
  const [selectedCourt, setSelectedCourt] = useState<CourtInfoWithPin | null>(null)
  const [activeTab, setActiveTab] = useState('courts')
  const [kioskMode, setKioskModeState] = useState<KioskMode>('club')
  const navigate = useNavigate()
  const { terms, i18nText } = useSportTerms()
  const { courts, connected, socket, requestCourtsWithPins, generateCourtPin, appError, allHistories } = useSocketContext()
  const { logout, ownerPin, setCourtPin, isOwner, tournamentToken } = useAuthContext()
  const stats = useDashboardStats(courts)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)
  const { saveSession, findAnyValidSession, clearSession } = useRefereeSession()

  const bracketApi = useBracket(socket)
  // Slice 4.5 (D12): the owner picker consumes the SAME catalog + availability
  // view as the admin (useCourtInventory) — ACTIVE inventory courts only.
  const inventory = useCourtInventory(socket, connected)
  /** Owner picker list: ACTIVE inventory courts (id + name for BracketView). */
  const pickerCourts: CourtInfo[] = useMemo(
    () =>
      inventory.courts
        .filter((c) => c.inventoryStatus === INVENTORY_STATUS.ACTIVE)
        .map((c) => ({ id: c.courtId, name: c.name }) as CourtInfo),
    [inventory.courts],
  )
  /** TCS-4 strict cold-start: false → the picker shows the empty-state copy. */
  const hasActiveInventoryCourts = inventory.courts.some(
    (c) => c.inventoryStatus === INVENTORY_STATUS.ACTIVE,
  )
  /** CourtIds currently referenced by bracket matches (with a court assigned).
   *  These must NOT offer "Generar PIN" — the bracket owns them. */
  const bracketAssignedCourtIds: string[] = useMemo(() => {
    const b = bracketApi.bracket
    if (!b) return []
    const ids = new Set<string>()
    for (const m of b.matches) if (m.courtId) ids.add(m.courtId)
    if (b.thirdPlaceMatch?.courtId) ids.add(b.thirdPlaceMatch.courtId)
    return [...ids]
  }, [bracketApi.bracket])
  const { addToast } = useToast()

  // ── Court cleaning (PIN regeneration) — local UI state. The DELETE path is
  // GONE (slice 5.4): court existence is admin-only via INVENTORY_ARCHIVE.
  const [cleanConfirmCourtId, setCleanConfirmCourtId] = useState<string | null>(null)
  const requestClean = useCallback((courtId: string) => setCleanConfirmCourtId(courtId), [])
  const confirmClean = useCallback(() => {
    if (cleanConfirmCourtId && socket && connected) {
      socket.emit(SocketEvents.CLIENT.REGENERATE_PIN, { courtId: cleanConfirmCourtId })
    }
    setCleanConfirmCourtId(null)
  }, [cleanConfirmCourtId, socket, connected])
  const cancelClean = useCallback(() => setCleanConfirmCourtId(null), [])

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
      setSelectedCourt(court as CourtInfoWithPin)
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

  // Request history when the history tab is activated
  useEffect(() => {
    if (activeTab === 'history' && socket && connected && allHistories === null) {
      socket.emit(SocketEvents.CLIENT.GET_ALL_HISTORY)
    }
  }, [activeTab, socket, connected, allHistories])

  // Ask for fresh bracket state whenever the Torneo tab becomes active.
  useEffect(() => {
    if (activeTab === 'tournament' && socket && connected) {
      socket.emit(SocketEvents.CLIENT.BRACKET_GET)
    }
  }, [activeTab, socket, connected])

  // Listen for server kiosk mode changes
  useEffect(() => {
    if (!socket) return
    const handler = (data: { mode: KioskMode }) => setKioskModeState(data.mode)
    socket.on(SocketEvents.SERVER.KIOSK_MODE, handler)
    return () => { socket.off(SocketEvents.SERVER.KIOSK_MODE, handler) }
  }, [socket])

  /** ── Notification Modal ── */
  const handleNotificationSubmit = useCallback(({ type, message, duration }: { type: KioskNotificationType; message: string; duration: number }) => {
    if (!socket || !ownerPin) return
    setNotifModalOpen(false)
    socket.emit(SocketEvents.CLIENT.SEND_NOTIFICATION, {
      pin: ownerPin,
      type,
      message,
      duration,
    })
  }, [socket, ownerPin])

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

  const dashboardActions = <div className="flex flex-wrap gap-1 items-center">
    <div className="flex gap-1 p-0.5 rounded-lg bg-surface-low border border-border">
      <button
        onClick={() => socket?.emit(SocketEvents.CLIENT.SET_KIOSK_MODE, { mode: 'club' })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-150 ${
          kioskMode === 'club' ? 'bg-surface text-text shadow-sm hover:brightness-100 active:brightness-100' : 'text-text-muted hover:text-text'
        }`}
      >
        <Monitor size={14} />
        {i18nText('ownerKioskModeClub')}
      </button>
      <button
        onClick={() => socket?.emit(SocketEvents.CLIENT.SET_KIOSK_MODE, { mode: 'tournament' })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-150 ${
          kioskMode === 'tournament' ? 'bg-surface text-text shadow-sm hover:brightness-100 active:brightness-100' : 'text-text-muted hover:text-text'
        }`}
      >
        <Trophy size={14} />
        {i18nText('ownerKioskModeTournament')}
      </button>
      <button
        onClick={() => socket?.emit(SocketEvents.CLIENT.SET_KIOSK_MODE, { mode: 'bracket' })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-150 ${
          kioskMode === 'bracket' ? 'bg-surface text-text shadow-sm hover:brightness-100 active:brightness-100' : 'text-text-muted hover:text-text'
        }`}
        aria-label={i18nText('ownerKioskModeBracket')}
      >
        <ListTree size={14} />
        {i18nText('ownerKioskModeBracket')}
      </button>
    </div>
    <Button
      variant="secondary"
      size="xs"
      onClick={() => setNotifModalOpen(true)}
      icon={<Bell size={14} />}
    >
      {i18nText('notificationModalTitle')}
    </Button>
    {/* Export CSV button — only for owners when FINISHED courts exist */}
    {isOwner && hasFinishedCourts && (
      <Button
        variant="secondary"
        size="xs"
        onClick={downloadCsv}
        icon={<Download size={14} />}
      >
        {i18nText('exportCsv')}
      </Button>
    )}
    {/* End Tournament button — only for owners when courts exist */}
    {isOwner && hasCourts && (
      <Button
        variant="danger"
        size="xs"
        onClick={() => setFinishDialogOpen(true)}
        icon={<Flag size={14} />}
      >
        {i18nText('finishTournament')}
      </Button>
    )}
  </div>

  return (
    <div className="flex flex-col h-dvh bg-background">
      <PageHeader
        title={i18nText('ownerTitle')}
        subtitle={i18nText('ownerSubtitle')}
        showStatus={true}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <Button variant="ghost" onClick={() => { sessionStorage.removeItem('rallyos-owner-restored'); logout(); navigate(Routes.AUTH) }} size="sm" icon={<ArrowLeft size={16} />}>
            {i18nText('commonBack')}
          </Button>
        }
      />

      <main id="main-content" className="flex-1 overflow-auto bg-primary/10">
        {/* Sticky top bar: stats + actions + integrated tabs */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-primary/5">
          <div className="px-4 py-2">
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
                courts: terms.dashboardStatCourts,
                matches: i18nText('dashboardStatMatches'),
                players: i18nText('dashboardStatPlayers'),
              }}
              gridViewLabel={i18nText('dashboardGridView')}
              listViewLabel={i18nText('dashboardListView')}
            />
          </div>
          {/* Tabs integrated into the same white surface — full width, selectable */}
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
              label={i18nText('ownerViewHistory')}
              icon={<Clock size={16} />}
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
            />
            <Tab
              id="tournament"
              label={i18nText('bracketTabTournament')}
              icon={<Trophy size={16} />}
              active={activeTab === 'tournament'}
              onClick={() => setActiveTab('tournament')}
            />
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {activeTab === 'courts' ? (
            <DashboardGrid
              courts={courts}
              onCourtClick={handleCourtClick}
              viewMode={viewMode}
              showPin={true}
              showQr={true}
              onCleanCourt={requestClean}
              cleanConfirmCourtId={cleanConfirmCourtId}
              onCleanCourtConfirm={() => {
                confirmClean();
                requestCourtsWithPins(ownerPin || '');
                addToast('success', terms.toastCourtCleaned);
              }}
              onCleanCourtCancel={cancelClean}
              featuredCourtId={courts.find(t => t.featured)?.id ?? null}
              onToggleFeatured={handleToggleFeatured}
              onGeneratePin={generateCourtPin}
              bracketAssignedCourtIds={bracketAssignedCourtIds}
            />
          ) : activeTab === 'tournament' ? (
            <BracketView
              bracket={bracketApi.bracket}
              courts={pickerCourts}
              error={bracketApi.error}
              resetToken={bracketApi.resetToken}
              hasAvailableCourts={hasActiveInventoryCourts}
              onCreate={bracketApi.createBracket}
              onAssignPlayer={bracketApi.assignPlayer}
              onSetWinner={bracketApi.setWinner}
              onAssignCourt={bracketApi.assignCourt}
              onSelectTable={bracketApi.selectTable}
              onUndo={bracketApi.undoMatch}
              onReset={() => bracketApi.reset()}
              onResetConfirm={bracketApi.resetConfirm}
              onClearError={bracketApi.clearError}
            />
          ) : allHistories !== null && allHistories.length > 0 ? (
            <HistoryAccordion entries={allHistories} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Typography variant="body" className="text-text-muted">
                {i18nText('historyNoEvents')}
              </Typography>
            </div>
          )}
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
