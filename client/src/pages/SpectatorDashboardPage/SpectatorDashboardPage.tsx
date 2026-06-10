/**
 * Spectator Dashboard Page
 * Allows spectators to view available tables and join as viewers (no PIN required)
 */

import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/molecules/PageHeader'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { SocketEvents } from '@shared/events'
import { Routes, buildScoreboardRoute } from '@/routes'

export interface SpectatorDashboardPageProps {}

export function SpectatorDashboardPage(_props: SpectatorDashboardPageProps) {
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { courts, emit } = useSocketContext()
  const { login } = useAuthContext()

  const availableCourts = courts

  // Espectador entra directo sin PIN ni nombre
  const handleJoinTable = (tableId: string) => {
    // Emit JOIN_TABLE as spectator (no PIN needed)
    emit(SocketEvents.CLIENT.JOIN_COURT, { courtId: tableId, name: 'Espectador', role: 'viewer' })
    
    // Store table info
    login('viewer', tableId)
    
    // Navigate to scoreboard spectator view (no controls)
    navigate(buildScoreboardRoute(tableId, 'view'))
  }

  return (
    <div className="flex flex-col h-dvh bg-surface">
      <PageHeader
        title={i18nText('spectatorTitle')}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <Button
            variant="ghost"
            onClick={() => navigate(Routes.AUTH)}
            size="sm"
          >
            {i18nText('commonBack')}
          </Button>
        }
      />

      {/* Tables Grid */}
      <main id="main-content" className="flex-1 overflow-auto p-4 bg-primary/10">
        {availableCourts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Typography variant="title">{i18nText('spectatorNoCourts')}</Typography>
            <Typography variant="body" className="text-text-muted">
              {i18nText('spectatorTryLater')}
            </Typography>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableCourts.map((court) => (
              <div
                key={court.id}
                className="card p-4 bg-surface-secondary rounded-lg border border-border cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleJoinTable(court.id)}
              >
                <h3 className="font-heading font-bold text-lg mb-2">{court.name}</h3>
                <p className="text-text-muted">
                  {court.playerNames?.a || i18nText('commonPlayerA')} vs {court.playerNames?.b || i18nText('commonPlayerB')}
                </p>
                <p className="text-sm text-primary mt-2">{i18nText('spectatorTapToView')}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}