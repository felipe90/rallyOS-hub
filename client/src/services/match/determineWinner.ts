/**
 * Match winner determination
 *
 * Pure functions for detecting set and match winners.
 * No React dependencies - testable in isolation.
 */

import type { Player } from '@shared/types'

/**
 * Determine the winner of the current set.
 * Returns null if no winner yet.
 */
export function determineSetWinner(
  scoreA: number,
  scoreB: number,
  pointsPerSet: number,
): Player | null {
  if (scoreA >= pointsPerSet && scoreA > scoreB) {
    return 'A'
  }
  if (scoreB >= pointsPerSet && scoreB > scoreA) {
    return 'B'
  }
  return null
}

/**
 * Determine the winner of the match (best of N sets).
 * Returns null if match is not over.
 */
export function determineMatchWinner(
  setsA: number,
  setsB: number,
  totalSets: number,
): Player | null {
  const setsNeeded = Math.ceil((totalSets + 1) / 2)

  if (setsA >= setsNeeded) {
    return 'A'
  }
  if (setsB >= setsNeeded) {
    return 'B'
  }
  return null
}
