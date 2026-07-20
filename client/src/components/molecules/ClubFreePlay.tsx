/**
 * ClubFreePlay — free-mode session screen (timer + buttons, no score, no names).
 *
 * Per design decision, free mode shows only the timer and action buttons.
 * Player names are omitted — free play is informal and doesn't require
 * named players.
 */
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import { formatElapsed } from '@/hooks/useClubTimer'

export interface ClubFreePlayProps {
  /** Server-authoritative elapsed seconds (formatted to MM:SS / HH:MM:SS). */
  elapsedSeconds: number
  /** Opens the match-config screen (useClubPlay.newMatch flow). */
  onPlayMatch: () => void
  /** Triggers the end-session confirmation flow. */
  onEndSession: () => void
}

export function ClubFreePlay({
  elapsedSeconds,
  onPlayMatch,
  onEndSession,
}: ClubFreePlayProps) {
  const { i18nText } = useI18n()
  const formatted = formatElapsed(elapsedSeconds)

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