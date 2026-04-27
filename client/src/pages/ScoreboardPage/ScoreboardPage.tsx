/**
 * Scoreboard Page
 * Unified scoreboard that determines controls based on URL path (via hooks)
 * - /scoreboard/:tableId/referee → full referee controls
 * - /scoreboard/:tableId/view → display only
 */

import { useNavigate, useParams } from 'react-router-dom'
import { useSocketContext, useAuthContext } from '@/contexts'
import { usePermissions } from '@/hooks/usePermissions'
import { useScoreboardUrl } from '@/hooks/useScoreboardUrl'
import { useOrientation } from '@/hooks/useOrientation'
import { useScoreboardEvents } from './useScoreboardEvents'
import { useMatchState, useRefAuth, useRefRevoked } from './'
import { ScoreboardMain } from '@/components/organisms/ScoreboardMain'
import { MatchConfigPanel } from '@/components/organisms/MatchConfigPanel'
import { HistoryDrawer } from '@/components/organisms/HistoryDrawer'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { ConnectionStatus, Button, Typography, CoachMark } from '@/components/atoms'
import { useState, useEffect } from 'react'
import { Routes } from '@/routes'

export interface ScoreboardPageProps {}

function RefRevokedView() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-surface gap-4 p-4">
      <Typography variant="headline" className="text-center">Árbitr@ removido</Typography>
      <Typography variant="body" className="text-center text-muted-foreground">
        El organizador ha regenerado el PIN de esta mesa.
      </Typography>
      <Typography variant="label" className="text-center">Redirigiendo a sala de espera...</Typography>
    </div>
  )
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <ConnectionStatus />
      <p className="text-text-muted">Cargando partido...</p>
    </div>
  )
}

export function ScoreboardPage(_props: ScoreboardPageProps) {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { currentMatch, emit, connected, socket } = useSocketContext()
  const { isReferee, isOwner, tablePin } = useAuthContext()
  const { scoreboard: perms } = usePermissions()
  const { canEdit, canConfigure, canViewHistory } = perms
  const { isLandscape, toggle: toggleOrientation } = useOrientation()

  useScoreboardUrl(tableId)
  const { handleScorePoint, handleSubtractPoint, handleUndo, handleSetServer, handleSwapSides, handleStartMatch, handleCancelMatch } =
    useScoreboardEvents({ emit, tableId: tableId ?? '', canEdit, connected })

  useMatchState(emit, tableId, connected)
  useRefAuth(emit, tableId, connected, canEdit, tablePin)
  const refRevoked = useRefRevoked({ socket, tableId: tableId ?? '', navigate })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showWinnerDialog, setShowWinnerDialog] = useState(false)

  // Detect when match finishes to show winner dialog
  useEffect(() => {
    if (currentMatch?.status === 'FINISHED' && currentMatch?.winner && !showWinnerDialog) {
      setShowWinnerDialog(true)
    }
  }, [currentMatch?.status, currentMatch?.winner, showWinnerDialog])

  if (!tableId) return <div>Invalid table ID</div>
  if (refRevoked) return <RefRevokedView />
  if (!currentMatch) return <LoadingView />

  if (canConfigure && currentMatch.status !== 'LIVE') return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Configurar Partido"
        actions={<Button variant="ghost" size="sm" onClick={handleCancelMatch}>Atrás</Button>}
      />
      <div className="flex-1 overflow-auto bg-primary">
        <MatchConfigPanel onStart={handleStartMatch} onCancel={handleCancelMatch}
          defaultConfig={{ pointsPerSet: 11, bestOf: 3, handicapA: 0, handicapB: 0 }}
        />
      </div>
    </div>
  )

  const backRoute = isOwner ? Routes.DASHBOARD_OWNER : isReferee ? Routes.DASHBOARD_REFEREE : Routes.DASHBOARD_SPECTATOR

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title={`${currentMatch.playerNames?.a || 'A'} vs ${currentMatch.playerNames?.b || 'B'}`}
        landscape={isLandscape}
        actions={<>
          {canViewHistory && <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>Historial</Button>}
          <Button variant="ghost" size="sm" onClick={() => navigate(backRoute)}>Atrás</Button>
        </>}
      />
      <div className="flex-1 overflow-auto bg-primary">
        <ScoreboardMain
          match={currentMatch}
          onScorePoint={handleScorePoint}
          onSubtractPoint={handleSubtractPoint}
          onUndo={handleUndo}
          onSettingsClick={() => handleSetServer('A')}
          onSwapSides={handleSwapSides}
          onHistoryClick={() => setHistoryOpen(true)}
          onBackClick={() => navigate(backRoute)}
          isReferee={canEdit}
          isLandscape={isLandscape}
          onOrientationToggle={toggleOrientation}
        />
      </div>
      <HistoryDrawer
        isOpen={historyOpen}
        events={currentMatch.history || []}
        onClose={() => setHistoryOpen(false)}
        onUndo={handleUndo}
      />

      {/* Match Winner Dialog */}
      <ConfirmDialog
        isOpen={showWinnerDialog}
        title="¡Partido Finalizado!"
        message={`Ganador: ${currentMatch.winner === 'A' ? currentMatch.playerNames?.a || 'Jugador A' : currentMatch.playerNames?.b || 'Jugador B'}`}
        severity="success"
        confirmLabel="Continuar"
        cancelLabel=""
        onConfirm={() => {
          setShowWinnerDialog(false)
          navigate(backRoute)
        }}
        onCancel={() => {}}
      />

      {/* CoachMark for first-time referees */}
      {canEdit && currentMatch.status === 'LIVE' && (
        <CoachMark
          id="scoreboard-tap-hint"
          message="Tocá cualquier lado del marcador para sumar un punto"
          show={true}
        />
      )}
    </div>
  )
}
