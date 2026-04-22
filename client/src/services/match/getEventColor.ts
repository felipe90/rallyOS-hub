/**
 * Match event color coding
 *
 * Pure functions for determining CSS color classes for history events.
 * No React dependencies - testable in isolation.
 */

import type { ScoreChange } from '@shared/types'

/**
 * Get the CSS color class for a ScoreChange event.
 */
export function getEventColor(event: ScoreChange): string {
  if (event.action === 'SET_WON') {
    return 'text-[var(--color-score-winner)]'
  }
  if (event.player === 'A') {
    return 'text-[var(--color-score-player-a)]'
  }
  if (event.player === 'B') {
    return 'text-[var(--color-score-player-b)]'
  }
  return 'text-[var(--color-score-neutral)]'
}
