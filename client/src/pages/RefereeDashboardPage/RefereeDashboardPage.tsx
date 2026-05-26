/**
 * Referee Dashboard Page
 * Simplified dashboard for referees - can join tables with PIN but cannot create them
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PinModal } from '@/components/molecules/PinModal'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { usePinSubmission } from '@/hooks/usePinSubmission'
import { useRefereeSession } from '@/hooks/useRefereeSession'
import { Button } from '@/components/atoms/Button'
import { Routes, buildScoreboardRoute } from '@/routes'
import type { TableInfoWithPin } from '@shared/types'
import { Table2, Swords, Users } from 'lucide-react'

export interface RefereeDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function RefereeDashboardPage({ viewMode: initialViewMode }: RefereeDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { tables, connected, socket, requestTables } = useSocketContext()
  const { logout, setTablePin } = useAuthContext()
  const stats = useDashboardStats(tables)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)
  const { saveSession, findAnyValidSession, clearSession } = useRefereeSession()

  // Referee gets regular tables (no PINs visible)
  useEffect(() => {
    if (!connected) return
    requestTables()
  }, [connected, requestTables])

  // Auto-restore valid referee session on first visit only
  // Uses sessionStorage to prevent re-triggering when navigating back from scoreboard
  useEffect(() => {
    if (!connected || tables.length === 0) return
    const alreadyRestored = sessionStorage.getItem('rallyos-ref-restored')
    if (alreadyRestored) return
    const session = findAnyValidSession(tables)
    if (session) {
      sessionStorage.setItem('rallyos-ref-restored', '1')
      setTablePin(session.pin)
      navigate(buildScoreboardRoute(session.tableId, 'referee'))
    } else {
      // No valid session — clear flag so auto-restore works next time
      sessionStorage.removeItem('rallyos-ref-restored')
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

  const handleLogout = () => {
    sessionStorage.removeItem('rallyos-ref-restored')
    logout()
    navigate(Routes.AUTH)
  }

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

  return (
    <div className="flex flex-col h-dvh bg-surface">
      <PageHeader
        title={i18nText('refereeTitle')}
        subtitle={i18nText('refereeSubtitle')}
        showStatus={true}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <Button variant="ghost" onClick={handleLogout} size="sm" animate={false}>
            {i18nText('commonBack')}
          </Button>
        }
      />

      <main id="main-content" className="flex-1 overflow-auto bg-primary/10">
        <div className="p-4">
          <DashboardHeader
            totalTables={stats.totalTables}
            liveMatches={stats.liveMatches}
            activePlayers={stats.activePlayers}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
            showPin={false}
            showQr={false}
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
        title={i18nText('matchConfigTitle')}
        forTableLabel={i18nText('matchConfigForTable', { tableName: selectedTable?.name || '' })}
        cancelLabel={i18nText('commonCancel')}
        submitLabel={i18nText('authEnter')}
        submitLoadingLabel={i18nText('authVerifying')}
      />
    </div>
  )
}
