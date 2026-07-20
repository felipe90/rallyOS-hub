/**
 * ClubSessionConfig — initial mode selector shown on JOIN before any play.
 *
 * Contract (spec scenarios 1, 2):
 *   - Two selectable mode cards: "🎯 Modo Libre" / "🏆 Modo Match"
 *   - "Comenzar" disabled until a mode is selected
 *   - On "Comenzar" → onSelectFree (free) or onSelectMatch (match)
 *
 * The parent (ClubPlayPage) wires:
 *   - onSelectFree → useClubPlay.startFreePlay() (emits CLUB_START_FREE)
 *   - onSelectMatch → render ClubMatchConfig
 */
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import type { SessionMode } from '@shared/types'

export interface ClubSessionConfigProps {
  /** Emitted when the player selects "Modo Libre" and confirms. */
  onSelectFree: () => void
  /** Emitted when the player selects "Modo Match" and confirms. */
  onSelectMatch: () => void
}

export function ClubSessionConfig({ onSelectFree, onSelectMatch }: ClubSessionConfigProps) {
  const { i18nText } = useI18n()
  const [selected, setSelected] = useState<SessionMode | null>(null)

  const handleStart = () => {
    if (selected === 'free') {
      onSelectFree()
    } else if (selected === 'match') {
      onSelectMatch()
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4"
      data-testid="club-session-config"
    >
      <Typography variant="title" className="text-center">
        {i18nText('clubPlaySessionConfigTitle')}
      </Typography>

      <div className="flex flex-col gap-3 w-full max-w-sm" role="radiogroup" aria-label="session-mode">
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'free'}
          onClick={() => setSelected('free')}
          className={`text-left w-full p-4 rounded-xl border-2 transition-colors ${
            selected === 'free'
              ? 'border-primary bg-primary/10'
              : 'border-border bg-surface hover:bg-surface-low'
          }`}
          data-testid="mode-free"
        >
          <Typography variant="headline" className="text-2xl">
            {i18nText('clubPlayModeFree')}
          </Typography>
          <Typography variant="body" className="text-muted-foreground">
            {i18nText('clubPlayModeFreeDesc')}
          </Typography>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selected === 'match'}
          onClick={() => setSelected('match')}
          className={`text-left w-full p-4 rounded-xl border-2 transition-colors ${
            selected === 'match'
              ? 'border-primary bg-primary/10'
              : 'border-border bg-surface hover:bg-surface-low'
          }`}
          data-testid="mode-match"
        >
          <Typography variant="headline" className="text-2xl">
            {i18nText('clubPlayModeMatch')}
          </Typography>
          <Typography variant="body" className="text-muted-foreground">
            {i18nText('clubPlayModeMatchDesc')}
          </Typography>
        </button>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleStart}
        disabled={selected === null}
        fullWidth
        className="max-w-sm"
      >
        {i18nText('clubPlayModeStart')}
      </Button>
    </div>
  )
}