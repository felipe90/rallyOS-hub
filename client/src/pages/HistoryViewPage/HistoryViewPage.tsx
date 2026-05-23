/**
 * History View Page
 * Owner-only page for viewing match history across all tables.
 *
 * Emits GET_ALL_HISTORY on mount to request aggregated history from the server,
 * then renders collapsible per-table sections via HistoryAccordion.
 */

import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/molecules/PageHeader'
import { HistoryAccordion } from '@/components/molecules/HistoryAccordion'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { Routes } from '@/routes'
import { SocketEvents } from '@shared/events'
import { RefreshCw } from 'lucide-react'

export function HistoryViewPage() {
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { socket, connected, allHistories } = useSocketContext()
  const { isOwner, isReferee } = useAuthContext()

  // Request aggregated history from server
  const requestHistory = useCallback(() => {
    if (socket && connected) {
      socket.emit(SocketEvents.CLIENT.GET_ALL_HISTORY)
    }
  }, [socket, connected])

  // Emit on mount and when socket/connected changes
  useEffect(() => {
    requestHistory()
  }, [requestHistory])

  // Redirect non-owners to their appropriate dashboard based on role
  useEffect(() => {
    if (!isOwner) {
      if (isReferee) {
        navigate(Routes.DASHBOARD_REFEREE)
      } else {
        navigate(Routes.DASHBOARD_SPECTATOR)
      }
    }
  }, [isOwner, isReferee, navigate])

  const hasHistoryEntries = allHistories !== null && allHistories.length > 0
  const isLoading = allHistories === null && connected

  // Don't render anything while checking auth
  if (!isOwner) {
    return null
  }

  return (
    <div className="flex flex-col h-dvh bg-surface">
      <PageHeader
        title={i18nText('historyTitle')}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={requestHistory} disabled={!connected}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={() => navigate(Routes.DASHBOARD_OWNER)} size="sm">
              {i18nText('commonBack')}
            </Button>
          </div>
        }
      />

      <main id="main-content" className="flex-1 overflow-auto p-4 bg-primary/10">
        {isLoading ? (
          <div className="text-center text-text-muted py-12">
            <Typography variant="body">{i18nText('historyLoading')}</Typography>
          </div>
        ) : hasHistoryEntries ? (
          <HistoryAccordion entries={allHistories} />
        ) : (
          <div className="text-center text-text-muted py-12">
            <Typography variant="body">{i18nText('historyNoEvents')}</Typography>
          </div>
        )}
      </main>
    </div>
  )
}
