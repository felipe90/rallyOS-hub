/**
 * Match event formatting
 *
 * Pure functions for formatting ScoreChange events for display.
 * No React dependencies - testable in isolation.
 */

import type { ScoreChange } from '@shared/types'

/**
 * Format a ScoreChange event into a human-readable string.
 */
export function formatEvent(event: ScoreChange): string {
  switch (event.action) {
    case 'SET_WON':
      return formatSetWon(event)
    case 'POINT':
      return formatPoint(event)
    case 'CORRECTION':
      return formatCorrection(event)
    default:
      return String(event.action)
  }
}

function formatSetWon(event: ScoreChange): string {
  const winner = event.player || 'A'
  const winnerScore = winner === 'A' ? event.pointsAfter.a : event.pointsAfter.b
  const loserScore = winner === 'A' ? event.pointsAfter.b : event.pointsAfter.a
  return `Set ${event.setNumber || '?'} - ${winner} ${winnerScore}-${loserScore}`
}

function formatPoint(event: ScoreChange): string {
  const player = event.player || '?'
  return `${player}: ${event.pointsAfter.a}-${event.pointsAfter.b}`
}

function formatCorrection(event: ScoreChange): string {
  return `Corr: ${event.pointsAfter.a}-${event.pointsAfter.b}`
}
