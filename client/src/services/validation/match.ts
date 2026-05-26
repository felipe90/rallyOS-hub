/**
 * Match config validation
 *
 * Pure functions for validating match configuration.
 * Uses SportDisplayRegistry to delegate sport-specific validation.
 * Uses i18nText singleton — no React dependencies.
 */

import type { Sport } from '@shared/types'
import { SPORT } from '@shared/types'
import { i18nText } from '@/i18n'
import { SportDisplayRegistry } from '../../adapters/SportDisplayRegistry'

export const MIN_POINTS_PER_SET = 1
export const MAX_POINTS_PER_SET = 99
export const MIN_BEST_OF = 1
export const MAX_BEST_OF = 9

const registry = new SportDisplayRegistry()

/**
 * Validate match configuration (sport-aware).
 * Accepts a loose config object since callers may provide partial/flat configs.
 * Dispatches sport-specific validation to the adapter resolved from config.sport.
 */
export function validateMatchConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Common validation (applies to all sports)
  if (config.bestOf !== undefined) {
    if ((config.bestOf as number) < MIN_BEST_OF || (config.bestOf as number) > MAX_BEST_OF) {
      errors.push(i18nText('validationBestOfRange', { min: MIN_BEST_OF, max: MAX_BEST_OF }))
    }
    if ((config.bestOf as number) % 2 === 0) {
      errors.push(i18nText('validationBestOfOdd'))
    }
  }

  // Resolve sport from config, default to TT
  const sport: Sport = (config.sport as Sport) || SPORT.TABLE_TENNIS

  // Delegate sport-specific validation to adapter
  const adapter = registry.resolve(sport)
  errors.push(...adapter.validateConfig(config))

  return { valid: errors.length === 0, errors }
}
