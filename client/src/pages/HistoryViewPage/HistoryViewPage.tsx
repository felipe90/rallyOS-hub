/**
 * History View Page
 * Owner-only page for viewing match history across all tables
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/molecules/PageHeader'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { Routes } from '@/routes'

export function HistoryViewPage() {
  const navigate = useNavigate()
  const { currentMatch } = useSocketContext()
  const { isOwner, isReferee } = useAuthContext()

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

  // Don't render anything while checking auth
  if (!isOwner) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Historial"
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm">
            Atrás
          </Button>
        }
      />

      {/* History List */}
      <div className="flex-1 overflow-auto p-4 bg-primary/10">
        {!currentMatch?.history || currentMatch.history.length === 0 ? (
          <div className="text-center text-text-muted">
            <Typography variant="body">Sin eventos registrados</Typography>
          </div>
        ) : (
          <div className="space-y-2">
            {currentMatch.history.map((event, idx) => (
              <div
                key={idx}
                className="p-3 bg-surface-secondary rounded-lg border border-border"
              >
                <Typography variant="body">
                  {event.action === 'POINT' ? '⚽ Punto' : '↩️ Deshacer'} - {event.player}
                </Typography>
                <Typography variant="caption" className="text-text-muted">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
