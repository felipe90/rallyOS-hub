/**
 * ClubMatchConfig — match setup form (points per set, best of, handicap, names).
 *
 * Spec task 4.2 + design doc "Configuración del Match".
 *
 * Contract:
 *   - Dropdown (button-group) for "Puntos por set" (default 15; options 6, 11, 15, 21)
 *   - Dropdown (button-group) for "Al mejor de" (default 3; options 1, 3, 5)
 *   - Steppers for handicap A & B (default 0/0)
 *   - Two text inputs for player names (default empty)
 *   - "Empezar partido" → onSubmit({ courtId, playerNameA, playerNameB, matchConfig })
 *   - "Cancelar" → onCancel
 *
 * The matchConfig partial is forwarded by useClubPlay.newMatch to the server's
 * PR-2 CourtManager.newMatch(optional matchConfig) override path. Defaults are
 * only the overrides; the server fills in minDifference and other required
 * fields from the sport's base config.
 */
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import { SPORT } from '@shared/types'
import type { MatchConfig } from '@shared/types'

const POINTS_OPTIONS = [6, 11, 15, 21] as const
const BEST_OF_OPTIONS = [1, 3, 5] as const

export interface ClubMatchConfigPayload {
  courtId: string
  playerNameA: string
  playerNameB: string
  matchConfig: Partial<MatchConfig>
}

export interface ClubMatchConfigProps {
  /** Court id bundle into the emitted payload. */
  courtId: string
  /** Emits when "Empezar partido" is pressed. */
  onSubmit: (payload: ClubMatchConfigPayload) => void
  /** Emits when "Cancelar" is pressed. Optional. */
  onCancel?: () => void
}

function HandicapStepper({
  side,
  value,
  onDecrement,
  onIncrement,
}: {
  side: 'A' | 'B'
  value: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 bg-surface-low rounded-md p-3">
      <Typography variant="label">{side}</Typography>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDecrement}
          aria-label={`decrement handicap ${side.toLowerCase()}`}
          className="!p-2"
        >
          −
        </Button>
        <div className="w-10 text-center font-heading text-xl font-bold" aria-live="polite">
          {value}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onIncrement}
          aria-label={`increment handicap ${side.toLowerCase()}`}
          className="!p-2"
        >
          +
        </Button>
      </div>
    </div>
  )
}

export function ClubMatchConfig({ courtId, onSubmit, onCancel }: ClubMatchConfigProps) {
  const { i18nText } = useI18n()
  const [pointsPerSet, setPointsPerSet] = useState<number>(15)
  const [bestOf, setBestOf] = useState<number>(3)
  const [handicapA, setHandicapA] = useState(0)
  const [handicapB, setHandicapB] = useState(0)
  const [playerNameA, setPlayerNameA] = useState('')
  const [playerNameB, setPlayerNameB] = useState('')

  const handleSubmit = () => {
    onSubmit({
      courtId,
      playerNameA: playerNameA.trim(),
      playerNameB: playerNameB.trim(),
      matchConfig: {
        sport: SPORT.TABLE_TENNIS,
        pointsPerSet,
        bestOf,
        handicapA,
        handicapB,
      } as Partial<MatchConfig>,
    })
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-5 p-4"
      data-testid="club-match-config"
    >
      <Typography variant="title" className="text-center">
        {i18nText('clubPlayMatchConfigTitle')}
      </Typography>

      <div className="w-full max-w-sm flex flex-col gap-5">
        {/* Puntos por set */}
        <div className="flex flex-col gap-2">
          <Typography variant="label">{i18nText('clubPlayPointsPerSet')}</Typography>
          <div className="flex gap-2">
            {POINTS_OPTIONS.map((p) => (
              <Button
                key={p}
                variant={pointsPerSet === p ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setPointsPerSet(p)}
                fullWidth
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {/* Al mejor de */}
        <div className="flex flex-col gap-2">
          <Typography variant="label">{i18nText('clubPlayBestOf')}</Typography>
          <div className="flex gap-2">
            {BEST_OF_OPTIONS.map((b) => (
              <Button
                key={b}
                variant={bestOf === b ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setBestOf(b)}
                fullWidth
              >
                {b}
              </Button>
            ))}
          </div>
        </div>

        {/* Handicap */}
        <div className="flex flex-col gap-2">
          <Typography variant="label">{i18nText('clubPlayHandicap')}</Typography>
          <div className="grid grid-cols-2 gap-3">
            <HandicapStepper
              side="A"
              value={handicapA}
              onDecrement={() => setHandicapA((n) => n - 1)}
              onIncrement={() => setHandicapA((n) => n + 1)}
            />
            <HandicapStepper
              side="B"
              value={handicapB}
              onDecrement={() => setHandicapB((n) => n - 1)}
              onIncrement={() => setHandicapB((n) => n + 1)}
            />
          </div>
        </div>

        {/* Player names */}
        <div className="flex flex-col gap-2">
          <Typography variant="label">{i18nText('clubPlayNameA')}</Typography>
          <input
            type="text"
            value={playerNameA}
            onChange={(e) => setPlayerNameA(e.target.value)}
            placeholder={i18nText('clubPlayNameA')}
            className="w-full px-4 py-3 rounded-md border border-border bg-surface text-text text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={30}
          />
          <Typography variant="label" className="mt-2">
            {i18nText('clubPlayNameB')}
          </Typography>
          <input
            type="text"
            value={playerNameB}
            onChange={(e) => setPlayerNameB(e.target.value)}
            placeholder={i18nText('clubPlayNameB')}
            className="w-full px-4 py-3 rounded-md border border-border bg-surface text-text text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={30}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {i18nText('clubPlayCancel')}
            </Button>
          )}
          <Button variant="primary" onClick={handleSubmit} className="flex-1">
            {i18nText('clubPlayStartMatchBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}