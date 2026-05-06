/**
 * Match config validation
 *
 * Pure functions for validating match configuration.
 * Uses i18nText singleton — no React dependencies.
 */

import type { MatchConfig } from '@shared/types'
import { i18nText } from '@/i18n'

export const MIN_POINTS_PER_SET = 1
export const MAX_POINTS_PER_SET = 99
export const MIN_BEST_OF = 1
export const MAX_BEST_OF = 9

/**
 * Validate match configuration.
 */
export function validateMatchConfig(config: Partial<MatchConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (config.pointsPerSet !== undefined) {
    if (config.pointsPerSet < MIN_POINTS_PER_SET || config.pointsPerSet > MAX_POINTS_PER_SET) {
      errors.push(i18nText('validationPointsPerSetRange', { min: MIN_POINTS_PER_SET, max: MAX_POINTS_PER_SET }))
    }
  }

  if (config.bestOf !== undefined) {
    if (config.bestOf < MIN_BEST_OF || config.bestOf > MAX_BEST_OF) {
      errors.push(i18nText('validationBestOfRange', { min: MIN_BEST_OF, max: MAX_BEST_OF }))
    }
    if (config.bestOf % 2 === 0) {
      errors.push(i18nText('validationBestOfOdd'))
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

  return { valid: errors.length === 0, errors }
}
