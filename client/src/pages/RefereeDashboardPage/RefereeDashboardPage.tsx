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
import logoImg from '@/assets/logo-big.png'
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
  const [selectedCourt, setSelectedCourt] = useState<TableInfoWithPin | null>(null)
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { courts, connected, socket, requestCourts } = useSocketContext()
  const { logout, setCourtPin } = useAuthContext()
  const stats = useDashboardStats(courts)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)
  const { saveSession, findAnyValidSession, clearSession } = useRefereeSession()

  // Referee gets regular courts (no PINs visible)
  useEffect(() => {
    if (!connected) return
    requestCourts()
  }, [connected, requestCourts])

  // Auto-restore valid referee session on first visit only
  // Uses sessionStorage to prevent re-triggering when navigating back from scoreboard
  useEffect(() => {
    if (!connected || courts.length === 0) return
    const alreadyRestored = sessionStorage.getItem('rallyos-ref-restored')
    if (alreadyRestored) return
    const session = findAnyValidSession(courts)
    if (session) {
      sessionStorage.setItem('rallyos-ref-restored', '1')
      setCourtPin(session.pin)
      navigate(buildScoreboardRoute(session.tableId, 'referee'))
    } else {
      // No valid session — clear flag so auto-restore works next time
      sessionStorage.removeItem('rallyos-ref-restored')
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

  const handleLogout = () => {
    sessionStorage.removeItem('rallyos-ref-restored')
    logout()
    navigate(Routes.AUTH)
  }

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
        logo={logoImg}
        showStatus={true}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <Button variant="ghost" onClick={handleLogout} size="sm">
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
            showPin={false}
            showQr={false}
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
        title={i18nText('matchConfigTitle')}
        forTableLabel={i18nText('matchConfigForCourt', { courtName: selectedCourt?.name || '' })}
        cancelLabel={i18nText('commonCancel')}
        submitLabel={i18nText('authEnter')}
        submitLoadingLabel={i18nText('authVerifying')}
      />
    </div>
  )
}
