import { useNavigate, useParams } from 'react-router-dom'
import { useSocketContext } from '../../contexts/SocketContext'
import { useAuth } from '../../hooks/useAuth'
import { ScoreboardMain } from '../../components/organisms/ScoreboardMain'
import { MatchConfigPanel } from '../../components/organisms/MatchConfigPanel'
import { HistoryDrawer } from '../../components/organisms/HistoryDrawer'
import { PageHeader } from '../../components/molecules/PageHeader'
import { ConnectionStatus } from '../../components/atoms/ConnectionStatus'
import { Button } from '../../components/atoms/Button'
import { useState, useEffect } from 'react'

export function ScoreboardPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { currentMatch, emit, connected } = useSocketContext()
  const { isReferee } = useAuth()
  const [historyOpen, setHistoryOpen] = useState(false)

  if (!tableId) {
    return <div>Invalid table ID</div>
  }

  // Request match data when component mounts or tableId changes
  useEffect(() => {
    if (connected && tableId) {
      console.log(`[Scoreboard] Requesting match data for table: ${tableId}`)
      emit('GET_MATCH_STATE', { tableId })
    }
  }, [tableId, connected, emit])

  // Authenticate as referee when page loads (if referee)
  useEffect(() => {
    if (connected && tableId && isReferee) {
      const tablePin = localStorage.getItem('tablePin') || '12345'
      console.log(`[Scoreboard] Authenticating as referee for table: ${tableId} with PIN: ${tablePin}`)
      emit('SET_REF', { tableId, pin: tablePin })
    }
  }, [tableId, connected, isReferee, emit])

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
    emit('RECORD_POINT', { player, tableId })
  }

  const handleSubtractPoint = (player: 'A' | 'B') => {
    if (!connected) {
      console.warn('Not connected to server')
      return
    }
    emit('SUBTRACT_POINT', { player, tableId })
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

  const handleStartMatch = (config: { 
    pointsPerSet: number; 
    bestOf: number; 
    handicapA?: number; 
    handicapB?: number;
    playerNameA?: string;
    playerNameB?: string;
  }) => {
    if (!connected) {
      console.warn('Not connected to server')
      return
    }
    console.log(`[Scoreboard] Starting match with config:`, config)
    console.log(`[Scoreboard] Emitting START_MATCH with tableId:`, tableId)
    emit('START_MATCH', { 
      tableId, 
      pointsPerSet: config.pointsPerSet,
      bestOf: config.bestOf,
      handicapA: config.handicapA,
      handicapB: config.handicapB,
      playerNameA: config.playerNameA,
      playerNameB: config.playerNameB
    })
    console.log(`[Scoreboard] START_MATCH event emitted`)
  }

  const handleCancelMatch = () => {
    navigate('/dashboard')
  }

  // Show config panel if match is not live (referee only)
  if (isReferee && currentMatch.status !== 'LIVE') {
    return (
      <div className="flex flex-col h-screen bg-surface">
        <PageHeader
          title="Configurar Partido"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelMatch}
            >
              Atrás
            </Button>
          }
        />

        <div className="flex-1 overflow-auto">
          <MatchConfigPanel
            onStart={handleStartMatch}
            onCancel={handleCancelMatch}
            defaultConfig={{
              pointsPerSet: 11,
              bestOf: 3,
              handicapA: 0,
              handicapB: 0,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title={`${currentMatch.playerNames?.a || 'A'} vs ${currentMatch.playerNames?.b || 'B'}`}
        landscape={true}
        actions={
          <>
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
              onClick={() => navigate(isReferee ? '/dashboard' : '/waiting-room')}
            >
              Atrás
            </Button>
          </>
        }
      />

      {/* Scoreboard */}
      <div className="flex-1 overflow-auto">
        <ScoreboardMain
          match={currentMatch}
          onScorePoint={handleScorePoint}
          onSubtractPoint={handleSubtractPoint}
          onUndo={handleUndo}
          onSettingsClick={() => handleSetServer('A')}
          onHistoryClick={() => setHistoryOpen(true)}
          onBackClick={() => navigate(isReferee ? '/dashboard' : '/waiting-room')}
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
