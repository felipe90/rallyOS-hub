/**
 * ClubPlayPage — Club player scoreboard with full scoreboard experience
 *
 * Route: /club/play/:courtId
 * States: loading → player-name-prompt → playing → finished
 *
 * Uses ScoreboardMain with all standard controls (scoring, undo, swap sides,
 * orientation toggle, set history, history drawer).
 * No MatchConfigModal (auto-start), no RallyTap (deferred), no WinnerDialog
 * (club players navigate home after finish).
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocketContext } from '@/contexts/SocketContext'
import { useClubPlay } from '@/hooks/useClubPlay'
import { useOrientation } from '@/hooks/useOrientation'
import { ScoreboardMain } from '@/components/organisms/ScoreboardMain'
import { PlayerNamePrompt } from '@/components/molecules/PlayerNamePrompt/PlayerNamePrompt'
import { PageHeader } from '@/components/molecules/PageHeader'
import { HistoryDrawer } from '@/components/organisms/HistoryDrawer'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { ConnectionStatus } from '@/components/atoms'
import { useI18n } from '@/i18n'
import { Routes } from '@/routes'
import type { MatchStateExtended } from '@shared/types'

/** Loading state — spinner + "Conectando..." */
function LoadingView() {
  const { i18nText } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
      <ConnectionStatus
        labels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
      />
      <Typography variant="body" className="text-muted-foreground">
        {i18nText('clubPlayLoading')}
      </Typography>
    </div>
  )
}

/** Finished state — final score + "Volver al inicio" button */
function FinishedView({
  matchState,
  onBack,
}: {
  matchState: MatchStateExtended | null
  onBack: () => void
}) {
  const { i18nText } = useI18n()
  const nameA = matchState?.playerNames?.a || i18nText('clubPlayScoreA')
  const nameB = matchState?.playerNames?.b || i18nText('clubPlayScoreB')
  const lastSet = matchState?.setHistory?.[matchState.setHistory.length - 1]
  const scoreA = lastSet?.a ?? 0
  const scoreB = lastSet?.b ?? 0

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4">
      <Typography variant="title">{i18nText('clubPlayFinished')}</Typography>
      <Typography variant="headline" className="text-primary text-center">
        {nameA} {scoreA} — {scoreB} {nameB}
      </Typography>
      <Button variant="primary" size="lg" onClick={onBack} animate={false}>
        {i18nText('clubPlayGoHome')}
      </Button>
    </div>
  )
}

export function ClubPlayPage() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()
  const { socket, connected } = useSocketContext()
  const { i18nText } = useI18n()
  const { isLandscape, toggle: toggleOrientation } = useOrientation()
  const {
    matchState, loading, error, finished,
    scorePoint, subtractPoint, undoLast, swapSides, startMatch,
  } = useClubPlay(socket, courtId ?? '', connected)

  // History drawer
  const [historyOpen, setHistoryOpen] = useState(false)

  // Track whether we should show the name prompt.
  // The prompt is shown when match is WAITING (not yet started).
  // If match is already LIVE/FINISHED on mount, skip the prompt.
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [promptResolved, setPromptResolved] = useState(false)

  // Decide whether to show the name prompt when match state arrives
  useEffect(() => {
    if (matchState && !promptResolved) {
      if (matchState.status === 'WAITING') {
        setShowNamePrompt(true)
      } else {
        // Already LIVE or FINISHED — no prompt needed
        setShowNamePrompt(false)
        setPromptResolved(true)
      }
    }
  }, [matchState, promptResolved])

  const handleNameSubmit = (nameA: string, nameB: string) => {
    setShowNamePrompt(false)
    setPromptResolved(true)
    startMatch(nameA, nameB)
  }

  const handleBackToHome = () => {
    navigate(Routes.AUTH)
  }

  if (!courtId) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-surface">
        <Typography variant="body">{i18nText('scoreboardInvalidCourtId')}</Typography>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
        <Typography variant="body" className="text-red-500">
          {error === 'CONNECTION_ERROR' ? i18nText('toastConnectionError') : i18nText('scoreboardLoading')}
        </Typography>
        <Button variant="ghost" onClick={handleBackToHome} animate={false}>
          {i18nText('clubPlayGoHome')}
        </Button>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return <LoadingView />
  }

  // Error if no match state after loading
  if (!matchState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
        <Typography variant="body" className="text-muted-foreground">
          {i18nText('scoreboardLoading')}
        </Typography>
        <Button variant="ghost" onClick={handleBackToHome} animate={false}>
          {i18nText('clubPlayGoHome')}
        </Button>
      </div>
    )
  }

  // Player name prompt (before match starts)
  if (showNamePrompt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-8 p-4">
        <PlayerNamePrompt
          onSubmit={handleNameSubmit}
          defaultNameA={matchState.playerNames?.a || i18nText('clubPlayNameA')}
          defaultNameB={matchState.playerNames?.b || i18nText('clubPlayNameB')}
        />
      </div>
    )
  }

  // Finished state
  if (finished || matchState.status === 'FINISHED') {
    return <FinishedView matchState={matchState} onBack={handleBackToHome} />
  }

  // Playing state — full scoreboard experience
  return (
    <div className="flex flex-col h-dvh bg-surface">
      <PageHeader
        title={`${matchState.playerNames?.a || i18nText('commonPlayerA')} vs ${matchState.playerNames?.b || i18nText('commonPlayerB')}`}
        landscape={isLandscape}
        connectionLabels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>
              {i18nText('scoreboardHistory')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBackToHome}>
              {i18nText('scoreboardBack')}
            </Button>
          </>
        }
      />
      <main id="main-content" className="flex-1 overflow-auto bg-primary">
        <ScoreboardMain
          match={matchState}
          onScorePoint={scorePoint}
          onSubtractPoint={subtractPoint}
          onUndo={undoLast}
          onSwapSides={swapSides}
          isReferee={true}
          isLandscape={isLandscape}
          onOrientationToggle={toggleOrientation}
        />
      </main>

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={historyOpen}
        events={matchState.history || []}
        onClose={() => setHistoryOpen(false)}
        onUndo={undoLast}
      />
    </div>
  )
}
