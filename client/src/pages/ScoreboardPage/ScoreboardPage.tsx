/**
 * Scoreboard Page
 * Unified scoreboard that determines controls based on URL path (via hooks)
 * - /scoreboard/:tableId/referee → full referee controls
 * - /scoreboard/:tableId/view → display only
 */

import { useNavigate, useParams } from 'react-router-dom'
import { useI18n, changeLanguage } from '@/i18n'
import { useSocketContext, useAuthContext } from '@/contexts'
import { usePermissions } from '@/hooks/usePermissions'
import { useScoreboardUrl } from '@/hooks/useScoreboardUrl'
import { useOrientation } from '@/hooks/useOrientation'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useScoreboardEvents } from './useScoreboardEvents'
import { useMatchState, useRefAuth, useRefRevoked } from './'
import { ScoreboardMain } from '@/components/organisms/ScoreboardMain'
import { MatchConfigModal } from '@/components/molecules/MatchConfigModal'
import { RallyTapConnectButton } from '@/components/molecules/RallyTapConnectButton'
import { useRallyTapBridge } from '@/hooks/useRallyTapBridge'
import { SPORT } from '@shared/types'
import type { Sport } from '@shared/types'
import { HistoryDrawer } from '@/components/organisms/HistoryDrawer'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { ConnectionStatus, Button, Typography, CoachMark } from '@/components/atoms'
import { useToast } from '@/components/molecules/Toast'
import { useState, useEffect, useRef } from 'react'
import { Routes } from '@/routes'

export interface ScoreboardPageProps {}

function RefRevokedView() {
  const { i18nText } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center h-dvh bg-surface gap-4 p-4">
      <Typography variant="headline" className="text-center">{i18nText('scoreboardRefRevokedTitle')}</Typography>
      <Typography variant="body" className="text-center text-muted-foreground">
        {i18nText('scoreboardRefRevokedMessage')}
      </Typography>
      <Typography variant="label" className="text-center">{i18nText('scoreboardRefRevokedRedirecting')}</Typography>
    </div>
  )
}

function LoadingView() {
  const { i18nText } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center h-dvh">
      <ConnectionStatus labels={{
        connected: i18nText('connectionConnected'),
        connecting: i18nText('connectionConnecting'),
        error: i18nText('connectionNoConnection'),
        disconnected: i18nText('connectionDisconnected'),
      }} />
      <p className="text-text-muted">{i18nText('scoreboardLoading')}</p>
    </div>
  )
}

export function ScoreboardPage(_props: ScoreboardPageProps) {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { i18nText } = useI18n()
  const { currentMatch, emit, connected, socket } = useSocketContext()
  const { isReferee, isOwner, courtPin } = useAuthContext()
  const { scoreboard: perms } = usePermissions()
  const { canEdit, canConfigure, canViewHistory } = perms
  const { isLandscape, toggle: toggleOrientation } = useOrientation()
  useWakeLock()

  useScoreboardUrl(tableId)
  const { handleScorePoint, handleSubtractPoint, handleUndo, handleSwapSides, handleStartMatch, handleCancelMatch } =
    useScoreboardEvents({ emit, tableId: tableId ?? '', canEdit, connected })

  useMatchState(emit, tableId, connected)
  useRefAuth(emit, tableId, connected, canEdit, courtPin)
  const refRevoked = useRefRevoked({ socket, tableId: tableId ?? '', navigate })
  const rallyTap = useRallyTapBridge(
    canEdit && currentMatch?.status === 'LIVE' ? socket : null,
    tableId ?? '',
  )
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showWinnerDialog, setShowWinnerDialog] = useState(false)
  const { addToast } = useToast()

  // Track previous match status for toast triggers
  const prevStatusRef = useRef(currentMatch?.status)

  // Toast when match starts (status transitions to LIVE)
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = currentMatch?.status;
    if (prevStatus !== 'LIVE' && currentMatch?.status === 'LIVE') {
      addToast('info', i18nText('toastMatchStarted'));
    }
  }, [currentMatch?.status, addToast, i18nText]);

  // Toast when winner dialog is shown (match finished with winner)
  useEffect(() => {
    if (showWinnerDialog) {
      const winnerName = currentMatch?.winner === 'A'
        ? (currentMatch?.playerNames?.a || i18nText('commonPlayerA'))
        : (currentMatch?.playerNames?.b || i18nText('commonPlayerB'));
      addToast('info', i18nText('toastWinnerAnnounced', { name: winnerName }));
    }
  }, [showWinnerDialog, addToast, i18nText, currentMatch?.winner, currentMatch?.playerNames]);

  // Detect when match finishes to show winner dialog
  // Uses sessionStorage to avoid re-showing on page reload/re-entry
  useEffect(() => {
    const key = `winner-shown-${tableId}`
    if (currentMatch?.status === 'FINISHED' && currentMatch?.winner) {
      if (sessionStorage.getItem(key) !== 'true') {
        setShowWinnerDialog(true)
      }
    } else {
      sessionStorage.removeItem(key)
    }
  }, [currentMatch?.status, currentMatch?.winner, tableId])

  // Scoreboard page defaults to Spanish unless user explicitly chose a language
  useEffect(() => {
    if (!localStorage.getItem('rallyos-lang-explicit')) {
      changeLanguage('es-AR')
    }
  }, [])

  // Prevent overscroll on scoreboard page
  useEffect(() => {
    document.body.classList.add('scoreboard-page')
    return () => { document.body.classList.remove('scoreboard-page') }
  }, [])

  if (!tableId) return <div>{i18nText('scoreboardInvalidCourtId')}</div>
  if (refRevoked) return <RefRevokedView />
  if (!currentMatch) return <LoadingView />

  const backRoute = isOwner ? Routes.DASHBOARD_OWNER : isReferee ? Routes.DASHBOARD_REFEREE : Routes.DASHBOARD_SPECTATOR

  return (
    <div className="flex flex-col h-dvh bg-surface">
      <PageHeader
        title={`${currentMatch.playerNames?.a || 'A'} vs ${currentMatch.playerNames?.b || 'B'}`}
        landscape={isLandscape}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={<>
          {canViewHistory && <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>{i18nText('scoreboardHistory')}</Button>}
          <Button variant="ghost" size="sm" onClick={() => navigate(backRoute)}>{i18nText('scoreboardBack')}</Button>
        </>}
      />
      <main id="main-content" className="flex-1 overflow-auto bg-primary">
        <ScoreboardMain
          match={currentMatch}
          onScorePoint={handleScorePoint}
          onSubtractPoint={handleSubtractPoint}
          onUndo={handleUndo}
          onSwapSides={handleSwapSides}
          isReferee={canEdit}
          isLandscape={isLandscape}
          onOrientationToggle={toggleOrientation}
        />

      </main>

      {/* Match Config Modal */}
      <MatchConfigModal
        isOpen={canConfigure && currentMatch.status === 'WAITING'}
        courtId={tableId}
        courtName={currentMatch.courtName || ''}
        initialBestOf={(currentMatch.config?.bestOf as 1 | 3 | 5) || 3}
        initialHandicapA={((currentMatch.config) as any)?.handicapA || 0}
        initialHandicapB={((currentMatch.config) as any)?.handicapB || 0}
        initialSport={(localStorage.getItem('rallyos-sport') as Sport) || SPORT.TABLE_TENNIS}
        onSubmit={(config) => handleStartMatch({ ...config, pointsPerSet: 11 })}
        onClose={handleCancelMatch}
        title={i18nText('matchConfigTitle')}
        forTableLabel={i18nText('matchConfigForCourt', { courtName: currentMatch.courtName || '' })}
        playersLabel={i18nText('matchConfigPlayers')}
        playerAPlaceholder={i18nText('matchConfigPlayerAPlaceholder')}
        playerBPlaceholder={i18nText('matchConfigPlayerBPlaceholder')}
        bestOfLabel={i18nText('matchConfigBestOf')}
        handicapLabel={i18nText('matchConfigHandicap')}
        teamALabel={i18nText('matchConfigTeamA')}
        teamBLabel={i18nText('matchConfigTeamB')}
        cancelLabel={i18nText('commonCancel')}
        submitLabel={i18nText('matchConfigStart')}
        submitLoadingLabel={i18nText('matchConfigStarting')}
      />

      <HistoryDrawer
        isOpen={historyOpen}
        events={currentMatch.history || []}
        onClose={() => setHistoryOpen(false)}
        onUndo={handleUndo}
      />

      {/* Match Winner Dialog */}
      <ConfirmDialog
        isOpen={showWinnerDialog}
        title={i18nText('scoreboardWinnerDialogTitle')}
        message={i18nText('scoreboardWinnerDialogWinner', {
          name: currentMatch.winner === 'A'
            ? (currentMatch.playerNames?.a || i18nText('commonPlayerA'))
            : (currentMatch.playerNames?.b || i18nText('commonPlayerB')),
        })}
        severity="success"
        confirmLabel={i18nText('scoreboardWinnerDialogContinue')}
        onConfirm={() => {
          setShowWinnerDialog(false)
          sessionStorage.setItem(`winner-shown-${tableId}`, 'true')
          navigate(backRoute)
        }}
      />

      {/* RallyTap BLE bridge — solo referee con match LIVE */}
      {canEdit && currentMatch.status === 'LIVE' && (
        <div className="fixed bottom-6 left-6 z-50">
          <RallyTapConnectButton
            bleStatus={rallyTap.bleStatus}
            deviceName={rallyTap.deviceName}
            errorMessage={rallyTap.errorMessage}
            onConnect={rallyTap.connect}
            onDisconnect={rallyTap.disconnect}
          />
        </div>
      )}

      {/* CoachMark for first-time referees */}
      {canEdit && currentMatch.status === 'LIVE' && (
        <CoachMark
          id="scoreboard-tap-hint"
          message={i18nText('scoreboardCoachmarkMessage')}
          show={true}
        />
      )}
    </div>
  )
}
