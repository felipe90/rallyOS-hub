import { useNavigate, useParams } from 'react-router-dom'
import { useSocketContext } from '../contexts/SocketContext'
import { useAuth } from '../hooks/useAuth'
import { ScoreboardMain } from '../components/organisms/ScoreboardMain'
import { HistoryDrawer } from '../components/organisms/HistoryDrawer'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { Button } from '../components/atoms/Button'
import { useState } from 'react'

export function ScoreboardPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { currentMatch, emit, connected } = useSocketContext()
  const { isReferee } = useAuth()
  const [historyOpen, setHistoryOpen] = useState(false)

  if (!tableId) {
    return <div>Invalid table ID</div>
  }

  if (!currentMatch) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <ConnectionStatus />
        <p className="text-text-muted">Cargando partido...</p>
      </div>
    )
  }

  const handleScorePoint = (player: 'A' | 'B') => {
    if (!connected) {
      console.warn('Not connected to server')
      return
    }
    // Convert 'A' | 'B' to 'a' | 'b' for emit
    const playerKey = player.toLowerCase() as 'a' | 'b'
    emit('SCORE_POINT', { player: playerKey, tableId })
  }

  const handleUndo = () => {
    if (!connected) {
      console.warn('Not connected to server')
      return
    }
    emit('UNDO_LAST', { tableId })
  }

  const handleSetServer = (player: 'A' | 'B') => {
    if (!connected) {
      console.warn('Not connected to server')
      return
    }
    const playerKey = player.toLowerCase() as 'a' | 'b'
    emit('SET_SERVER', { player: playerKey, tableId })
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Connection Status Bar */}
      <ConnectionStatus />

      {/* Top Bar */}
      <div className="pt-12 p-4 border-b border-border flex justify-between items-center landscape:hidden">
        <h2 className="text-lg font-heading font-bold">{currentMatch.playerNames?.a || 'A'} vs {currentMatch.playerNames?.b || 'B'}</h2>
        <div className="flex gap-2">
          {isReferee && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              Historial
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            Atrás
          </Button>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex-1 overflow-auto">
        <ScoreboardMain
          match={currentMatch}
          onScorePoint={handleScorePoint}
          onUndo={handleUndo}
          onSettingsClick={() => handleSetServer('A')}
          onHistoryClick={() => setHistoryOpen(true)}
          isReferee={isReferee}
        />
      </div>

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={historyOpen}
        events={currentMatch.history || []}
        onClose={() => setHistoryOpen(false)}
        onUndo={handleUndo}
      />
    </div>
  )
}
