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
import { useTableManagement } from '@/hooks/useTableManagement'
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
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { tables, connected, socket, requestTablesWithPins, appError } = useSocketContext()
  const { logout, ownerPin, setTablePin, isOwner, tournamentToken } = useAuthContext()
  const stats = useDashboardStats(tables)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)
  const { saveSession, findAnyValidSession, clearSession } = useRefereeSession()

  const tableMgmt = useTableManagement({ socket, connected })
  const { addToast } = useToast()

  // Track previous creating state to detect table creation completion
  const wasCreatingRef = useRef(tableMgmt.isCreating)
  useEffect(() => {
    const wasCreating = wasCreatingRef.current;
    wasCreatingRef.current = tableMgmt.isCreating;
    // Transition: was creating → now not creating = table created successfully
    if (wasCreating && !tableMgmt.isCreating && !appError) {
      addToast('success', i18nText('toastTableCreated'));
    }
  }, [tableMgmt.isCreating, appError, addToast, i18nText]);

  // Toast on PIN error
  useEffect(() => {
    if (pinError) {
      addToast('error', i18nText('toastPinError'));
    }
  }, [pinError, addToast, i18nText]);

  // Derived: check if any FINISHED tables exist
  const hasFinishedTables = tables.some(t => t.status === 'FINISHED')
  const hasTables = tables.length > 0

  // Owner always gets tables with PINs
  useEffect(() => {
    if (!connected) return
    requestTablesWithPins(ownerPin || '')
  }, [connected, ownerPin, requestTablesWithPins])

  // Auto-restore valid referee session on first visit only
  useEffect(() => {
    if (!connected || tables.length === 0) return
    const alreadyRestored = sessionStorage.getItem('rallyos-owner-restored')
    if (alreadyRestored) return
    const session = findAnyValidSession(tables)
    if (session) {
      sessionStorage.setItem('rallyos-owner-restored', '1')
      setTablePin(session.pin)
      navigate(buildScoreboardRoute(session.tableId, 'referee'))
    } else {
      sessionStorage.removeItem('rallyos-owner-restored')
    }
  }, [connected, tables, findAnyValidSession, setTablePin, navigate])

  // Clear sessions for tables that transition to FINISHED
  useEffect(() => {
    for (const table of tables) {
      if (table.status === 'FINISHED') {
        clearSession(table.id)
      }
    }
  }, [tables, clearSession])

  // Listen for QR_DATA and PIN_REGENERATED events
  useEffect(() => {
    if (!socket) return

    const handleQRData = () => {
      // QR generated client-side from table data — server event is informational
    }

    const handlePinRegenerated = () => {
      requestTablesWithPins(ownerPin || '')
    }

    socket.on(SocketEvents.SERVER.QR_DATA, handleQRData)
    socket.on(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)

    return () => {
      socket.off(SocketEvents.SERVER.QR_DATA, handleQRData)
      socket.off(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)
    }
  }, [socket, ownerPin, requestTablesWithPins])

  /** ── PIN Modal ── */
  const handleTableClick = (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (table) {
      setSelectedTable(table as TableInfoWithPin)
      setPinModalOpen(true)
      clearError()
    }
  }

  const handlePinSubmit = async (pin: string) => {
    if (!selectedTable) return
    setTablePin(pin)
    const result = await submitPin(pin, selectedTable.id)
    if (result.success) {
      saveSession(selectedTable.id, pin)
      navigate(buildScoreboardRoute(selectedTable.id, 'referee'))
    }
  }

  const handlePinClose = () => {
    setPinModalOpen(false)
    setSelectedTable(null)
    clearError()
  }

  /** ── Featured Court Toggle ── */
  const handleToggleFeatured = useCallback((tableId: string) => {
    if (!socket) return
    const table = tables.find(t => t.id === tableId)
    const isCurrentlyFeatured = table?.featured === true
    socket.emit(SocketEvents.CLIENT.SET_FEATURED, {
      targetTableId: isCurrentlyFeatured ? null : tableId,
    })
  }, [socket, tables])

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
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rallyos-matches.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Silently fail — CSV is optional
    }
  }, [tournamentToken])

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

  const dashboardActions = <div className="flex gap-2 items-center">
    {!tableMgmt.isCreatingTable ? (
      <>
        <Button
          variant="primary"
          onClick={tableMgmt.startCreating}
          size="sm" animate={false}
          icon={<Plus size={18}
          />}
        >
          {i18nText('ownerCreateTable')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setNotifModalOpen(true)}
          animate={false}
          icon={<Bell size={18} />}
        >
          {i18nText('ownerCreateNotification')}
        </Button>
            <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(Routes.HISTORY)}
          animate={false}
          icon={<FileText size={18} />}
        >
          {i18nText('ownerViewHistory')}
        </Button>
        {/* Export CSV button — only for owners when FINISHED tables exist */}
        {isOwner && hasFinishedTables && (
          <Button
            variant="primary"
            size="sm"
            onClick={downloadCsv}
            animate={false}
            icon={<Download size={18} />}
          >
            {i18nText('exportCsv')}
          </Button>
        )}
        {/* End Tournament button — only for owners when tables exist */}
        {isOwner && hasTables && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setFinishDialogOpen(true)}
            animate={false}
            icon={<Flag size={18} />}
          >
            {i18nText('finishTournament')}
          </Button>
        )}
      </>
    ) : (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder={i18nText('ownerTableNamePlaceholder')}
            value={tableMgmt.tableName}
            onChange={(e) => tableMgmt.setTableName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !tableMgmt.isCreating) tableMgmt.createTable()
            }}
            className="px-3 py-2 rounded border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            disabled={tableMgmt.isCreating}
          />
          {tableMgmt.isCreating ? (
            <span className="text-sm text-amber-600 font-medium whitespace-nowrap">{i18nText('ownerCreating')}</span>
          ) : (
            <>
              <Button variant="primary" onClick={tableMgmt.createTable} size="sm" animate={false}>
                {i18nText('ownerCreate')}
              </Button>
              <Button variant="ghost" onClick={tableMgmt.cancelCreating} size="sm" animate={false}>
                {i18nText('commonCancel')}
              </Button>
            </>
          )}
        </div>
        {appError && (
          <div role="alert" className="flex items-center gap-2">
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
          <Button variant="ghost" onClick={() => { sessionStorage.removeItem('rallyos-owner-restored'); logout(); navigate(Routes.AUTH) }} size="sm" animate={false}>
            {i18nText('commonBack')}
          </Button>
        }
      />

      <main id="main-content" className="flex-1 overflow-auto bg-primary/10">
        <div className="p-4 ">
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
              tables: i18nText('dashboardStatTables'),
              matches: i18nText('dashboardStatMatches'),
              players: i18nText('dashboardStatPlayers'),
            }}
            gridViewLabel={i18nText('dashboardGridView')}
            listViewLabel={i18nText('dashboardListView')}
          />
          <DashboardGrid
            tables={tables}
            onTableClick={handleTableClick}
            viewMode={viewMode}
            showPin={true}
            showQr={true}
            onCleanTable={tableMgmt.requestClean}
            cleanTableId={tableMgmt.cleanConfirmTableId}
            onCleanTableConfirm={() => {
              tableMgmt.confirmClean();
              requestTablesWithPins(ownerPin || '');
              addToast('success', i18nText('toastTableCleaned'));
            }}
            onCleanTableCancel={tableMgmt.cancelClean}
            onDeleteTable={tableMgmt.requestDelete}
            showDeleteConfirm={tableMgmt.deleteConfirmTableId}
            onDeleteTableConfirm={() => {
              tableMgmt.confirmDelete();
              addToast('success', i18nText('toastTableDeleted'));
            }}
            onDeleteTableCancel={tableMgmt.cancelDelete}
            featuredTableId={tables.find(t => t.featured)?.id ?? null}
            onToggleFeatured={handleToggleFeatured}
          />
        </div>
      </main>

      <PinModal
        isOpen={pinModalOpen}
        tableName={selectedTable?.name || ''}
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
