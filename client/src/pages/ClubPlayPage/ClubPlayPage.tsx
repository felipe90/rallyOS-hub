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
import { motion, AnimatePresence } from 'framer-motion'
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

/** Finished state — final score + session info + actions */
function FinishedView({
  matchState,
  sessionEnded,
  onEndSession,
  onBack,
  endingSession,
}: {
  matchState: MatchStateExtended | null
  sessionEnded: { elapsedMinutes: number; cost: number; currency: string; reason: string } | null
  onEndSession: () => void
  onBack: () => void
  endingSession: boolean
}) {
  const { i18nText } = useI18n()
  const nameA = matchState?.playerNames?.a || i18nText('clubPlayScoreA')
  const nameB = matchState?.playerNames?.b || i18nText('clubPlayScoreB')
  const lastSet = matchState?.setHistory?.[matchState.setHistory.length - 1]
  const scoreA = lastSet?.a ?? 0
  const scoreB = lastSet?.b ?? 0

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4">
      <Typography variant="title">
        {sessionEnded ? i18nText('clubPlaySessionEnded') : i18nText('clubPlayFinished')}
      </Typography>
      <Typography variant="headline" className="text-primary text-center">
        {nameA} {scoreA} — {scoreB} {nameB}
      </Typography>

      {sessionEnded && (
        <div className="w-full max-w-sm bg-background rounded-xl p-6 shadow-md border border-border/50 flex flex-col gap-4 my-4 relative overflow-hidden">
          {/* Ticket styling accents */}
          <div className="absolute -left-3 top-1/2 w-6 h-6 bg-surface rounded-full border-r border-border/50 -translate-y-1/2"></div>
          <div className="absolute -right-3 top-1/2 w-6 h-6 bg-surface rounded-full border-l border-border/50 -translate-y-1/2"></div>
          
          <div className="flex justify-between items-center border-b border-dashed border-border/50 pb-4">
            <Typography variant="body" className="text-muted-foreground">
              {i18nText('clubPlayElapsedTime', { minutes: String(sessionEnded.elapsedMinutes) })}
            </Typography>
          </div>
          <div className="flex justify-between items-center pt-2">
            <Typography variant="body" className="font-semibold text-muted-foreground">
              Total
            </Typography>
            <Typography variant="headline" className="font-bold text-emerald-600 dark:text-emerald-400">
              {i18nText('clubPlayTotalCost', { cost: String(sessionEnded.cost), currency: sessionEnded.currency })}
            </Typography>
          </div>
        </div>
      )}

      {!sessionEnded && (
        <Button
          variant="primary"
          size="lg"
          onClick={onEndSession}
          disabled={endingSession}
        >
          {endingSession ? i18nText('clubPlayLoading') : i18nText('clubPlayEndSession')}
        </Button>
      )}

      <Button variant="ghost" size="lg" onClick={onBack}>
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
    matchState, loading, error, finished, reconnecting, refereeReplaced,
    sessionEnded, scorePoint, subtractPoint, undoLast, swapSides, startMatch, endSession,
  } = useClubPlay(socket, courtId ?? '', connected)

  // History drawer
  const [historyOpen, setHistoryOpen] = useState(false)

  // End session loading state
  const [endingSession, setEndingSession] = useState(false)

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

  const motionProps = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.2 },
  } as const

  return (
    <AnimatePresence mode="wait">
      {!courtId ? (
        <motion.div key="no-court" {...motionProps}>
          <div className="flex items-center justify-center min-h-dvh bg-surface">
            <Typography variant="body">{i18nText('scoreboardInvalidCourtId')}</Typography>
          </div>
        </motion.div>
      ) : error ? (
        <motion.div key="error" {...motionProps}>
          <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
            <Typography variant="body" className="text-red-500">
              {error === 'CONNECTION_ERROR' ? i18nText('toastConnectionError') : i18nText('scoreboardLoading')}
            </Typography>
            <Button variant="ghost" onClick={handleBackToHome}>
              {i18nText('clubPlayGoHome')}
            </Button>
          </div>
        </motion.div>
      ) : loading ? (
        <motion.div key="loading" {...motionProps}>
          <LoadingView />
        </motion.div>
      ) : reconnecting ? (
        <motion.div key="reconnecting" {...motionProps}>
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
              {i18nText('clubPlayReconnecting')}
            </Typography>
          </div>
        </motion.div>
      ) : !matchState ? (
        <motion.div key="no-match" {...motionProps}>
          <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
            <Typography variant="body" className="text-muted-foreground">
              {i18nText('scoreboardLoading')}
            </Typography>
            <Button variant="ghost" onClick={handleBackToHome}>
              {i18nText('clubPlayGoHome')}
            </Button>
          </div>
        </motion.div>
      ) : showNamePrompt ? (
        <motion.div key="prompt" {...motionProps}>
          <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-8 p-4">
            <PlayerNamePrompt
              onSubmit={handleNameSubmit}
              defaultNameA={matchState.playerNames?.a || i18nText('clubPlayNameA')}
              defaultNameB={matchState.playerNames?.b || i18nText('clubPlayNameB')}
            />
          </div>
        </motion.div>
      ) : finished || matchState.status === 'FINISHED' ? (
        <motion.div key="finished" {...motionProps}>
          <FinishedView
            matchState={matchState}
            sessionEnded={sessionEnded}
            onEndSession={() => {
              setEndingSession(true)
              endSession()
            }}
            onBack={handleBackToHome}
            endingSession={endingSession}
          />
        </motion.div>
      ) : (
        <motion.div key="playing" {...motionProps} className="flex flex-col h-dvh bg-surface relative">
          <AnimatePresence>
            {refereeReplaced && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-warning text-warning-foreground py-2 px-6 rounded-full shadow-lg border border-warning/20 text-sm font-semibold tracking-wide whitespace-nowrap"
              >
                {i18nText('clubPlayRefereeReplaced')}
              </motion.div>
            )}
          </AnimatePresence>
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
              isReferee={!refereeReplaced}
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
