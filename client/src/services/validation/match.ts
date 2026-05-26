/**
 * Match config validation
 *
 * Pure functions for validating match configuration.
 * Uses i18nText singleton — no React dependencies.
 */

import type { MatchConfig, TableTennisMatchConfig, PadelMatchConfig } from '@shared/types'
import { isTableTennisConfig, SPORT } from '@shared/types'
import { i18nText } from '@/i18n'

export const MIN_POINTS_PER_SET = 1
export const MAX_POINTS_PER_SET = 99
export const MIN_BEST_OF = 1
export const MAX_BEST_OF = 9

/**
 * Validate a table tennis configuration.
 */
function validateTTConfig(config: Partial<TableTennisMatchConfig>): string[] {
  const errors: string[] = []

  if (config.pointsPerSet !== undefined) {
    if (config.pointsPerSet < MIN_POINTS_PER_SET || config.pointsPerSet > MAX_POINTS_PER_SET) {
      errors.push(i18nText('validationPointsPerSetRange', { min: MIN_POINTS_PER_SET, max: MAX_POINTS_PER_SET }))
    }
  }

  if (config.minDifference !== undefined && config.minDifference < 1) {
    errors.push(i18nText('validationMinDifference'))
  }

  if (config.handicapA !== undefined && (config.handicapA < 0 || config.handicapA > 20)) {
    errors.push(i18nText('validationHandicapARange'))
  }

  if (config.handicapB !== undefined && (config.handicapB < 0 || config.handicapB > 20)) {
    errors.push(i18nText('validationHandicapBRange'))
  }

  return errors
}

/**
 * Validate a padel configuration.
 */
function validatePadelConfig(config: Partial<PadelMatchConfig>): string[] {
  const errors: string[] = []

  if (config.tiebreakPoints !== undefined && config.tiebreakPoints !== 7 && config.tiebreakPoints !== 10) {
    errors.push('Tiebreak points must be 7 or 10')
  }

  if (config.gamesPerSet !== undefined && config.gamesPerSet < 1) {
    errors.push('Games per set must be at least 1')
  }

  return errors
}

/**
 * Validate match configuration (sport-aware).
 * Accepts a loose config object since callers may provide partial/flat configs.
 */
export function validateMatchConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Common validation
  if (config.bestOf !== undefined) {
    if (config.bestOf < MIN_BEST_OF || config.bestOf > MAX_BEST_OF) {
      errors.push(i18nText('validationBestOfRange', { min: MIN_BEST_OF, max: MAX_BEST_OF }))
    }
    if (config.bestOf % 2 === 0) {
      errors.push(i18nText('validationBestOfOdd'))
    }
  }

  // Sport-specific validation
  const cfg = config as any
  if (isTableTennisConfig(config as MatchConfig)) {
    errors.push(...validateTTConfig({
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: cfg.pointsPerSet,
      bestOf: cfg.bestOf,
      minDifference: cfg.minDifference,
      handicapA: cfg.handicapA,
      handicapB: cfg.handicapB,
    }))
  } else {
    errors.push(...validatePadelConfig({
      sport: SPORT.PADEL,
      bestOf: cfg.bestOf,
      tiebreakPoints: cfg.tiebreakPoints,
      gamesPerSet: cfg.gamesPerSet,
      goldenPoint: cfg.goldenPoint,
    }))
  }

  return { valid: errors.length === 0, errors }
}
