import { useNavigate, useParams } from 'react-router-dom'
import { useSocketContext } from '../../contexts/SocketContext'
import { useAuth } from '../../hooks/useAuth'
import { ScoreboardMain } from '../../components/organisms/ScoreboardMain'
import { MatchConfigPanel } from '../../components/organisms/MatchConfigPanel'
import { HistoryDrawer } from '../../components/organisms/HistoryDrawer'
import { PageHeader } from '../../components/molecules/PageHeader'
import { ConnectionStatus } from '../../components/atoms/ConnectionStatus'
import { Button } from '../../components/atoms/Button'
import { Typography } from '../../components/atoms/Typography'
import { useState, useEffect } from 'react'
import type { RefRevokedEvent } from '@/shared/types'

export function ScoreboardPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { currentMatch, emit, connected, socket } = useSocketContext()
  const { isReferee } = useAuth()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [refRevoked, setRefRevoked] = useState(false)

  if (!tableId) {
    return <div>Invalid table ID</div>
  }

  // URL Scrubbing: Parse ?ePin= from URL and authenticate
  useEffect(() => {
    if (!connected || !socket) return

    const params = new URLSearchParams(window.location.search)
    const encryptedPin = params.get('ePin')

    if (encryptedPin) {
      console.log('[Scoreboard] Found encrypted PIN in URL:', encryptedPin.substring(0, 20) + '...')
      
      // Decode from URL-safe base64
      try {
        const decoded = atob(encryptedPin)
        const parts = decoded.split(':')
        
        if (parts.length === 2) {
          const [encrypted, timestamp] = parts
          
          // Simple XOR decryption (same logic as server)
          // Generate key from tableId + daily salt
          const generateKey = (tableId: string): string => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const dailySalt = today.getTime().toString()
            let hash = 0
            const combined = tableId + dailySalt
            for (let i = 0; i < combined.length; i++) {
              const char = combined.charCodeAt(i)
              hash = ((hash << 5) - hash) + char
              hash = hash & hash
            }
            return (hash >>> 0).toString(16).padStart(8, '0')
          }

          const key = generateKey(tableId)
          
          // Decrypt
          let decrypted = ''
          for (let i = 0; i < encrypted.length; i += 2) {
            const hexByte = encrypted.substr(i, 2)
            const charCode = parseInt(hexByte, 16)
            const keyChar = key[(i / 2) % key.length]
            decrypted += String.fromCharCode(charCode ^ keyChar.charCodeAt(0))
          }

          console.log('[Scoreboard] Decrypted PIN:', decrypted)

          if (/^\d{4}$/.test(decrypted)) {
            // Emit SET_REF to authenticate
            emit('SET_REF', { tableId, pin: decrypted })
            
            // URL Scrubbing: Clean the URL without reload
            window.history.replaceState({}, '', `/scoreboard/${tableId}`)
            console.log('[Scoreboard] URL cleaned, PIN authenticated')
          }
        }
      } catch (error) {
        console.error('[Scoreboard] Failed to decrypt PIN:', error)
      }
    }
  }, [connected, socket, tableId, emit])

  // Listen for REF_REVOKED event (when Kill-Switch is used)
  useEffect(() => {
    if (!socket) return

    const handleRefRevoked = (data: RefRevokedEvent) => {
      console.log('[Scoreboard] Referee revoked:', data)
      if (data.tableId === tableId) {
        setRefRevoked(true)
        // After a delay, redirect to waiting room
        setTimeout(() => {
          navigate('/waiting-room')
        }, 3000)
      }
    }

    socket.on('REF_REVOKED', handleRefRevoked)

    return () => {
      socket.off('REF_REVOKED', handleRefRevoked)
    }
  }, [socket, tableId, navigate])

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

  // Show revoked message if referee was kicked
  if (refRevoked) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-surface gap-4 p-4">
        <Typography variant="headline" className="text-center">
          Árbitr@ removido
        </Typography>
        <Typography variant="body" className="text-center text-muted-foreground">
          El organizador ha regenerado el PIN de esta mesa.
        </Typography>
        <Typography variant="label" className="text-center">
          Redirigiendo a sala de espera...
        </Typography>
      </div>
    )
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