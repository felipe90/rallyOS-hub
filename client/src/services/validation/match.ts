/**
 * Match config validation
 *
 * Pure functions for validating match configuration.
 * No React dependencies - testable in isolation.
 */

import type { MatchConfig } from '@shared/types'

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
      errors.push(`Puntos por set debe estar entre ${MIN_POINTS_PER_SET} y ${MAX_POINTS_PER_SET}`)
    }
  }

  if (config.bestOf !== undefined) {
    if (config.bestOf < MIN_BEST_OF || config.bestOf > MAX_BEST_OF) {
      errors.push(`Mejor de debe estar entre ${MIN_BEST_OF} y ${MAX_BEST_OF}`)
    }
    if (config.bestOf % 2 === 0) {
      errors.push('Mejor de debe ser un número impar')
    }
  }

  if (config.minDifference !== undefined && config.minDifference < 1) {
    errors.push('Diferencia mínima debe ser al menos 1')
  }

  if (config.handicapA !== undefined && (config.handicapA < 0 || config.handicapA > 20)) {
    errors.push('Handicap A debe estar entre 0 y 20')
  }

  if (config.handicapB !== undefined && (config.handicapB < 0 || config.handicapB > 20)) {
    errors.push('Handicap B debe estar entre 0 y 20')
  }

  return { valid: errors.length === 0, errors }
}
