/**
 * ClubFreePlay — free-mode session screen (timer + names + buttons, no score).
 *
 * Spec task 4.3 + design doc "Modo Libre".
 * Spec contract: Free mode MUST display timer + player names, MUST NOT
 * display scoring. Buttons: "Jugar partido" (open match config) +
 * "Terminar sesión" (end-session flow).
 *
 * The component is purely presentational — the parent (ClubPlayPage)
 * supplies a server-authoritative `elapsedSeconds` (sourced from
 * useClubTimer + the periodic CLUB_SESSION_TIMER sync) and wires the two
 * buttons to useClubPlay.newMatch (which opens ClubMatchConfig) and
 * useClubPlay.endSession(true) (initiates the end-session confirmation).
 */
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import { formatElapsed } from '@/hooks/useClubTimer'

export interface ClubFreePlayProps {
  /** Server-authoritative elapsed seconds (formatted to MM:SS / HH:MM:SS). */
  elapsedSeconds: number
  /** Optional player name A. Falls back to i18n placeholder. */
  playerNameA?: string
  /** Optional player name B. Falls back to i18n placeholder. */
  playerNameB?: string
  /** Opens the match-config screen (useClubPlay.newMatch flow). */
  onPlayMatch: () => void
  /** Triggers the end-session confirmation flow. */
  onEndSession: () => void
}

export function ClubFreePlay({
  elapsedSeconds,
  playerNameA,
  playerNameB,
  onPlayMatch,
  onEndSession,
}: ClubFreePlayProps) {
  const { i18nText } = useI18n()
  const formatted = formatElapsed(elapsedSeconds)
  const displayNameA = playerNameA || i18nText('clubPlayNameA')
  const displayNameB = playerNameB || i18nText('clubPlayNameB')

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4"
      data-testid="club-free-play"
    >
      {/* Timer */}
      <div className="flex flex-col items-center gap-1">
        <Typography variant="label" className="text-muted-foreground">
          {i18nText('clubPlayTimerLabel')}
        </Typography>
        <Typography variant="headline" className="font-mono tabular-nums">
          {formatted}
        </Typography>
      </div>

      {/* Free-mode badge */}
      <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 text-sm font-semibold">
        {i18nText('clubPlayFreeBadge')}
      </span>

      {/* Player names (no score) */}
      <div className="flex items-center justify-center gap-3">
        <Typography variant="title">{displayNameA}</Typography>
        <Typography variant="label" className="text-muted-foreground text-base normal-case">
          {i18nText('commonVs')}
        </Typography>
        <Typography variant="title">{displayNameB}</Typography>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button variant="primary" size="lg" onClick={onPlayMatch} fullWidth>
          {i18nText('clubPlayPlayMatch')}
        </Button>
        <Button variant="danger" size="lg" onClick={onEndSession} fullWidth>
          {i18nText('clubPlayEndSessionBtn')}
        </Button>
      </div>
    </div>
  )
}