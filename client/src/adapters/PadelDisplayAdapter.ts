/**
 * PadelDisplayAdapter — SportDisplayAdapter for padel.
 *
 * Extracts and encapsulates all padel-specific display logic:
 * - Score from padelPoints (0, 15, 30, 40, AD) converted to strings
 * - Current scores are games (not points)
 * - Serving from top-level `serving`
 * - Handicap: not supported (false)
 * - Display: PadelPointDisplay component
 * - Config: gamesPerSet (≥1), tiebreakPoints (7|10), goldenPoint (boolean)
 */

import { SPORT } from '@shared/types'
import type { MatchStateExtended, MatchConfig, Score, Player, SportDisplayScore } from '@shared/types'
import { PadelPointDisplay } from '../components/molecules/PadelPointDisplay/PadelPointDisplay'
import { calculateSetsWon } from '../services/match'
import type { SportDisplayAdapter, ConfigField, FormattedSet } from './SportDisplayAdapter'

export class PadelDisplayAdapter implements SportDisplayAdapter {
  readonly sport = SPORT.PADEL
  readonly displayKey = 'sportPadel'
  readonly DisplayComponent = PadelPointDisplay

  computeDisplayData(state: MatchStateExtended): SportDisplayScore {
    const s = state as any
    const pp = s.padelPoints ?? { a: 0, b: 0 }
    const games = s.games ?? { a: 0, b: 0 }
    const setHistory: Array<{ a: number; b: number }> = s.setHistory || []
    const { setsA, setsB } = calculateSetsWon(setHistory)

    return {
      type: SPORT.PADEL,
      leftPoint: String(pp.a),
      rightPoint: String(pp.b),
      leftGames: games.a ?? 0,
      rightGames: games.b ?? 0,
      leftSets: setsA,
      rightSets: setsB,
    }
  }

  getCurrentScores(state: MatchStateExtended): { a: number; b: number } {
    const s = state as any
    return {
      a: s.games?.a ?? 0,
      b: s.games?.b ?? 0,
    }
  }

  getServing(state: MatchStateExtended): Player {
    const s = state as any
    return s.serving ?? 'A'
  }

  needsHandicap(): boolean {
    return false
  }

  getConfigDefaults(): Partial<MatchConfig> {
    return {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
      goldenPoint: false,
    }
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = []

    const tb = config.tiebreakPoints as number | undefined
    if (tb !== undefined && tb !== 7 && tb !== 10) {
      errors.push(`tiebreakPoints: must be 7 or 10, got ${tb}`)
    }

    const gps = config.gamesPerSet as number | undefined
    if (gps !== undefined && gps < 1) {
      errors.push(`gamesPerSet: must be at least 1, got ${gps}`)
    }

    return errors
  }

  getConfigFields(): ConfigField[] {
    return [
      { name: 'gamesPerSet', type: 'number', label: 'Games por set', min: 1 },
      { name: 'tiebreakPoints', type: 'select', label: 'Tiebreak', options: [
        { value: 7, label: '7 puntos' },
        { value: 10, label: '10 puntos' },
      ]},
      { name: 'goldenPoint', type: 'boolean', label: 'Punto de Oro' },
    ]
  }

  formatSetHistory(setHistory: Score[]): FormattedSet[] {
    return setHistory.map((set, i) => ({
      left: set.a,
      right: set.b,
      label: `Set ${i + 1}`,
    }))
  }
}
