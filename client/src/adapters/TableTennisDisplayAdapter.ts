/**
 * TableTennisDisplayAdapter — SportDisplayAdapter for table tennis.
 *
 * Extracts and encapsulates all TT-specific display logic:
 * - Score from `score.currentSet.{a,b}`
 * - Serving from `score.serving`
 * - Handicap: supported (true)
 * - Display: TTPointDisplay component
 * - Config: pointsPerSet (1-99), minDifference (≥1), handicapA/B (0-20)
 */

import { SPORT, isTableTennisStateExtended } from '@shared/types'
import type { MatchStateExtended, MatchConfig, Score, Player, SportDisplayScore } from '@shared/types'
import { TTPointDisplay } from '../components/molecules/TTPointDisplay/TTPointDisplay'
import { calculateSetsWon } from '../services/match'
import { i18nText } from '../i18n'
import type { SportDisplayAdapter, ConfigField, FormattedSet } from './SportDisplayAdapter'

export class TableTennisDisplayAdapter implements SportDisplayAdapter {
  readonly sport = SPORT.TABLE_TENNIS
  readonly displayKey = 'sportTableTennis'
  readonly DisplayComponent = TTPointDisplay

  computeDisplayData(state: MatchStateExtended): SportDisplayScore {
    const score = isTableTennisStateExtended(state) ? state.score : { currentSet: { a: 0, b: 0 } }
    const setHistory: Array<{ a: number; b: number }> = (state as any).setHistory || []
    const { setsA, setsB } = calculateSetsWon(setHistory)

    return {
      type: SPORT.TABLE_TENNIS,
      leftScore: score.currentSet?.a ?? 0,
      rightScore: score.currentSet?.b ?? 0,
      leftSets: setsA,
      rightSets: setsB,
    }
  }

  getCurrentScores(state: MatchStateExtended): { a: number; b: number } {
    const s = state as any
    return {
      a: s.score?.currentSet?.a ?? 0,
      b: s.score?.currentSet?.b ?? 0,
    }
  }

  getServing(state: MatchStateExtended): Player {
    const s = state as any
    return s.score?.serving ?? 'A'
  }

  needsHandicap(): boolean {
    return true
  }

  getConfigDefaults(): Partial<MatchConfig> {
    return {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    }
  }

  validateConfig(config: Record<string, unknown>): string[] {
    const errors: string[] = []

    const pts = config.pointsPerSet as number | undefined
    if (pts !== undefined && (pts < 1 || pts > 99)) {
      errors.push(i18nText('validationPointsPerSetRange', { min: 1, max: 99 }))
    }

    const minDiff = config.minDifference as number | undefined
    if (minDiff !== undefined && minDiff < 1) {
      errors.push(i18nText('validationMinDifference'))
    }

    const hA = config.handicapA as number | undefined
    if (hA !== undefined && (hA < 0 || hA > 20)) {
      errors.push(i18nText('validationHandicapARange'))
    }

    const hB = config.handicapB as number | undefined
    if (hB !== undefined && (hB < 0 || hB > 20)) {
      errors.push(i18nText('validationHandicapBRange'))
    }

    return errors
  }

  getConfigFields(): ConfigField[] {
    return []
  }

  formatSetHistory(setHistory: Score[]): FormattedSet[] {
    return setHistory.map((set, i) => ({
      left: set.a,
      right: set.b,
      label: `Set ${i + 1}`,
    }))
  }
}
