/**
 * Match event formatting
 *
 * Pure functions for formatting ScoreChange events for display.
 * Uses i18nText singleton — no React dependencies.
 */

import type { ScoreChange } from '@shared/types'
import { i18nText } from '@/i18n'

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
  return i18nText('eventSet', { number: event.setNumber || '?', player: winner, scoreA: winnerScore, scoreB: loserScore })
}

function formatPoint(event: ScoreChange): string {
  const player = event.player || '?'
  return i18nText('eventPoint', { player, scoreA: event.pointsAfter.a, scoreB: event.pointsAfter.b })
}

function formatCorrection(event: ScoreChange): string {
  return i18nText('eventCorrection', { scoreA: event.pointsAfter.a, scoreB: event.pointsAfter.b })
}
