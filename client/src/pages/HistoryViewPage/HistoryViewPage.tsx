import { useNavigate } from 'react-router-dom'
import { useSocketContext } from '../../contexts/SocketContext'
import { PageHeader } from '../../components/molecules/PageHeader'
import { Button } from '../../components/atoms/Button'
import { Typography } from '../../components/atoms/Typography'

export function HistoryViewPage() {
  const navigate = useNavigate()
  const { currentMatch } = useSocketContext()

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Historial"
        showStatus={false}
        actions={
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            size="sm"
          >
            Atrás
          </Button>
        }
      />

      {/* History List */}
      <div className="flex-1 overflow-auto p-4">
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
