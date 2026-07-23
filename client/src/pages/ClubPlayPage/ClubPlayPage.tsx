/**
 * ClubPlayPage — Club player scoreboard (PR 4 refactored flow).
 *
 * Route: /club/play/:courtId
 *
 * Stage machine (PR 4):
 *   loading → reconnecting → session-config (Free/Match selector)
 *     → free-play OR match-config OR match-live → post-match modal
 *       (Reset/New Match/Free/End Session) → end-session confirm modal
 *         → finished (sessionEnded) → "Volver al inicio"
 *
 * Spec scenarios wired in this file:
 *   1 (Start free play) — session-config onSelectFree → startFreePlay
 *   2 (Start match from config) — ClubMatchConfig onSubmit → newMatch
 *   4 (Session ends) — CLUB_SESSION_ENDED drives FinishedView
 *   5a (Player opens end-session confirm) — endSession(false) arms modal
 *   5b (Player confirms) — endSession(true) → server transitions to FINISHED
 *   6 (Cancel end session) — cancelEndSession() local reset
 *   Match ends in club mode — PostMatchModal renders Reset/New/Free/End
 *
 * Timer uses useClubPlay.elapsedSeconds (server-authoritative, formatted
 * via useClubTimer.formatElapsed inside ClubFreePlay + ClubEndSessionConfirm).
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocketContext } from '@/contexts/SocketContext'
import { useClubPlay } from '@/hooks/useClubPlay'
import { useOrientation } from '@/hooks/useOrientation'
import { useRallyTapBridge } from '@/hooks/useRallyTapBridge'
import { ScoreboardMain } from '@/components/organisms/ScoreboardMain'
import { ClubSessionConfig } from '@/components/molecules/ClubSessionConfig'
import { ClubMatchConfig } from '@/components/molecules/ClubMatchConfig'
import type { ClubMatchConfigPayload } from '@/components/molecules/ClubMatchConfig'
import { ClubFreePlay } from '@/components/molecules/ClubFreePlay'
import { ClubEndSessionConfirm } from '@/components/molecules/ClubEndSessionConfirm'
import { PageHeader } from '@/components/molecules/PageHeader'
import { HistoryDrawer } from '@/components/organisms/HistoryDrawer'
import { RallyTapConnectButton } from '@/components/molecules'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { ConnectionStatus } from '@/components/atoms'
import { useI18n } from '@/i18n'
import { Routes } from '@/routes'
import type { MatchStateExtended, MatchConfig } from '@shared/types'

const motionProps = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.2 },
} as const

function connectionLabels(i18nText: (key: string, params?: Record<string, unknown>) => string) {
  return {
    connected: i18nText('connectionConnected'),
    connecting: i18nText('connectionConnecting'),
    error: i18nText('connectionNoConnection'),
    disconnected: i18nText('connectionDisconnected'),
  }
}

/** Loading state — spinner + "Conectando..." */
function LoadingView({ i18nText }: { i18nText: (key: string, params?: Record<string, unknown>) => string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
      <ConnectionStatus labels={connectionLabels(i18nText)} />
      <Typography variant="body" className="text-muted-foreground">
        {i18nText('clubPlayLoading')}
      </Typography>
    </div>
  )
}

/** Reconnecting state */
function ReconnectingView({ i18nText }: { i18nText: (key: string, params?: Record<string, unknown>) => string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-4 p-4">
      <ConnectionStatus labels={connectionLabels(i18nText)} />
      <Typography variant="body" className="text-muted-foreground">
        {i18nText('clubPlayReconnecting')}
      </Typography>
    </div>
  )
}

/** Post-match modal — Reset / New Match / Free / End Session (spec scenario post-match flow). */
function PostMatchModal({
  i18nText,
  matchState,
  onReset,
  onNewMatch,
  onFree,
  onEndSession,
}: {
  i18nText: (key: string, params?: Record<string, unknown>) => string
  matchState: MatchStateExtended
  onReset: () => void
  onNewMatch: () => void
  onFree: () => void
  onEndSession: () => void
}) {
  const nameA = matchState.playerNames?.a || i18nText('clubPlayNameA')
  const nameB = matchState.playerNames?.b || i18nText('clubPlayNameB')
  const lastSet = matchState.setHistory?.[matchState.setHistory.length - 1]
  const scoreA = lastSet?.a ?? 0
  const scoreB = lastSet?.b ?? 0

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4" data-testid="post-match-modal">
      <Typography variant="title" className="text-center">
        {i18nText('clubPlayPostMatchTitle')}
      </Typography>
      <Typography variant="headline" className="text-primary text-center">
        {nameA} {scoreA} — {scoreB} {nameB}
      </Typography>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button variant="primary" size="lg" onClick={onReset} fullWidth>
          {i18nText('clubPlayPostMatchReset')}
        </Button>
        <Button variant="secondary" size="lg" onClick={onNewMatch} fullWidth>
          {i18nText('clubPlayPostMatchNew')}
        </Button>
        <Button variant="secondary" size="lg" onClick={onFree} fullWidth>
          {i18nText('clubPlayPostMatchFree')}
        </Button>
        <Button variant="danger" size="lg" onClick={onEndSession} fullWidth>
          {i18nText('clubPlayEndSessionBtn')}
        </Button>
      </div>
    </div>
  )
}

/** Final session-ended view — elapsed time + cost summary + "Volver al inicio". */
function FinishedView({
  i18nText,
  sessionEnded,
  onBack,
}: {
  i18nText: (key: string, params?: Record<string, unknown>) => string
  sessionEnded: { elapsedMinutes: number; cost: number; currency: string; reason: string } | null
  onBack: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4">
      <Typography variant="title">
        {i18nText('clubPlaySessionEnded')}
      </Typography>

      {sessionEnded && (
        <div className="w-full max-w-sm bg-background rounded-xl p-6 shadow-md border border-border/50 flex flex-col gap-4 my-4 relative overflow-hidden">
          <div className="absolute -left-3 top-1/2 w-6 h-6 bg-surface rounded-full border-r border-border/50 -translate-y-1/2"></div>
          <div className="absolute -right-3 top-1/2 w-6 h-6 bg-surface rounded-full border-l border-border/50 -translate-y-1/2"></div>

          <div className="flex justify-between items-center border-b border-dashed border-border/50 pb-4">
            <Typography variant="body" className="text-muted-foreground">
              {i18nText('clubPlayElapsedTime', { minutes: String(sessionEnded.elapsedMinutes) })}
            </Typography>
          </div>
          <div className="flex justify-between items-center pt-2">
            <Typography variant="headline" className="font-bold text-emerald-600 dark:text-emerald-400">
              {i18nText('clubPlayTotalCost', { cost: String(sessionEnded.cost), currency: sessionEnded.currency })}
            </Typography>
          </div>
        </div>
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
    matchState, loading, error, reconnecting, refereeReplaced,
    sessionEnded, sessionMode, elapsedSeconds, pendingEndSessionConfirm,
    scorePoint, subtractPoint, undoLast, swapSides,
    endSession, startFreePlay, resetMatch, newMatch, cancelEndSession,
    encryptionKey,
  } = useClubPlay(socket, courtId ?? '', connected)

  const rallyTap = useRallyTapBridge(
    matchState?.status === 'LIVE' && !refereeReplaced ? socket : null,
    courtId ?? '',
  )

  const [historyOpen, setHistoryOpen] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  // PR 4 — local flag controlling the ClubMatchConfig screen overlay.
  // Set when the user picks "Modo Match" in session-config, presses
  // "Jugar partido" in free-play, or chooses "Nuevo partido" in the
  // post-match modal. Cleared on submit (the new match heads to LIVE)
  // or cancel (returns to whatever stage was underneath).
  const [matchConfigOpen, setMatchConfigOpen] = useState(false)
  // player-identity: retain name+phone from ClubSessionConfig until
  // ClubMatchConfig submits so they can be forwarded to newMatch.
  const [playerName, setPlayerName] = useState('')
  const [playerPhone, setPlayerPhone] = useState('')

  // Reset endingSession flag once the server confirms the session ended.
  useEffect(() => {
    if (sessionEnded) setEndingSession(false)
  }, [sessionEnded])

  const handleBackToHome = () => navigate(Routes.AUTH)

  const handleMatchConfigSubmit = (payload: ClubMatchConfigPayload) => {
    setMatchConfigOpen(false)
    // Only forward playerName/phone when they were set (from ClubSessionConfig flow).
    // When coming from free-play "Jugar partido" or post-match "Nuevo partido",
    // the player info was already sent at session start — skip it.
    newMatch(
      payload.playerNameA,
      payload.playerNameB,
      playerName || undefined,
      playerPhone || undefined,
      payload.matchConfig,
    )
  }

  const renderStage = (): React.ReactNode => {
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
          <Button variant="ghost" onClick={handleBackToHome}>
            {i18nText('clubPlayGoHome')}
          </Button>
        </div>
      )
    }
    if (reconnecting) {
      return <ReconnectingView i18nText={i18nText} />
    }
    if (loading || !matchState) {
      return <LoadingView i18nText={i18nText} />
    }
    if (sessionEnded) {
      return (
        <FinishedView
          i18nText={i18nText}
          sessionEnded={sessionEnded}
          onBack={handleBackToHome}
        />
      )
    }
    // Local UI overlay — match config form takes precedence over
    // whatever stage lies underneath. On submit or cancel the flag clears
    // and the page returns to the prior derived stage.
    if (matchConfigOpen) {
      return (
        <ClubMatchConfig
          courtId={courtId}
          onSubmit={handleMatchConfigSubmit}
          onCancel={() => setMatchConfigOpen(false)}
        />
      )
    }

    // Session-config — shown when no mode has been chosen yet (fresh join).
    // The server auto-starts the match as LIVE, so we rely on sessionMode
    // instead of status. On page refresh during active play, the reconnect
    // flow restores sessionMode before this renders.
    if (sessionMode === null) {
      return (
        <ClubSessionConfig
          onSelectFree={startFreePlay}
          onSelectMatch={(name, phone) => {
            setPlayerName(name)
            setPlayerPhone(phone)
            setMatchConfigOpen(true)
          }}
          encryptionKey={encryptionKey ?? undefined}
        />
      )
    }

    // Free-play screen (timer + buttons; no score, no names).
    // Player names omitted per design decision — free play is informal.
    if (sessionMode === 'free') {
      // onEndSession sets the local endingSession flag; the effect below
      // observes it and emits endSession(false) to arm the server-side
      // confirmation modal (spec scenario 5a).
      return (
        <ClubFreePlay
          elapsedSeconds={elapsedSeconds}
          onPlayMatch={() => setMatchConfigOpen(true)}
          onEndSession={() => setEndingSession(true)}
        />
      )
    }

    // Match-live — ScoreboardMain with all standard controls.
    if (matchState.status === 'LIVE') {
      return (
        <div className="flex flex-col h-dvh bg-surface relative">
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
            connectionLabels={connectionLabels(i18nText)}
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>
                  {i18nText('scoreboardHistory')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => startFreePlay()}>
                  {i18nText('clubPlayBackToFree')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setEndingSession(true)}>
                  {i18nText('clubPlayEndSessionBtn')}
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

          <HistoryDrawer
            isOpen={historyOpen}
            events={matchState.history || []}
            onClose={() => setHistoryOpen(false)}
            onUndo={undoLast}
          />

          {!refereeReplaced && (
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
        </div>
      )
    }

    // Post-match modal — match FINISHED in club mode, court still OCCUPIED.
    if (matchState.status === 'FINISHED' && sessionMode === 'match') {
      return (
        <PostMatchModal
          i18nText={i18nText}
          matchState={matchState}
          onReset={resetMatch}
          onNewMatch={() => setMatchConfigOpen(true)}
          onFree={startFreePlay}
          onEndSession={() => setEndingSession(true)}
        />
      )
    }

    // Fallback when state is inconsistent (should not happen in normal flow).
    return <LoadingView i18nText={i18nText} />
  }

  // When the user pressed an end-session trigger, fire endSession(false)
  // to arm the confirmation modal. The actual confirm emits with `true`
  // via the modal's onConfirm.
  useEffect(() => {
    if (endingSession && !pendingEndSessionConfirm && !sessionEnded) {
      endSession(false)
    }
  }, [endingSession, pendingEndSessionConfirm, sessionEnded, endSession])

  return (
    <AnimatePresence mode="wait">
      <motion.div key="club-play-stage" {...motionProps} className="relative">
        {renderStage()}

        {/* End-session confirmation overlay — rendered on top of the
            current stage when the server arms it via
            CLUB_END_SESSION_CONFIRM. */}
        {pendingEndSessionConfirm && (
          <ClubEndSessionConfirm
            isOpen
            elapsedSeconds={elapsedSeconds}
            onConfirm={() => endSession(true)}
            onCancel={() => {
              cancelEndSession()
              setEndingSession(false)
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}