/**
 * Match set calculation
 *
 * Pure functions for counting sets won.
 * No React dependencies - testable in isolation.
 */

import type { Score } from '@shared/types'

export interface SetsWon {
  setsA: number
  setsB: number
}

/**
 * Calculate how many sets each player has won from set history.
 */
export function calculateSetsWon(setHistory: Score[]): SetsWon {
  return {
    setsA: setHistory.filter(s => s.a > s.b).length,
    setsB: setHistory.filter(s => s.b > s.a).length,
  }
}
