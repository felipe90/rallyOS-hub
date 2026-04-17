/**
 * Scoreboard permission rules
 *
 * Pure functions for scoreboard authorization.
 * No React dependencies - testable in isolation.
 */

import type { UserRole, ScoreboardMode } from '@/contexts/AuthContext/AuthContext.types'

/**
 * Determine if user can edit the scoreboard.
 * Referee OR owner can edit, but only in referee mode.
 * (owner can arbitrate if needed)
 */
export function canEditScoreboard(
  role: UserRole,
  mode: ScoreboardMode,
): boolean {
  if (!role) return false

  const isAuthorizedRole = role === 'owner' || role === 'referee'
  return isAuthorizedRole && mode === 'referee'
}

/**
 * Determine if user can configure match settings.
 * Only available in referee mode, not when match is live.
 */
export function canConfigureMatch(
  role: UserRole,
  mode: ScoreboardMode,
  _status?: string, // reserved for future status check
): boolean {
  if (!role) return false

  const isAuthorizedRole = role === 'owner' || role === 'referee'
  // TODO: add status check once match status is available
  // const isNotLive = status !== 'live'
  return isAuthorizedRole && mode === 'referee'
}

/**
 * Determine if user can view match history.
 * Only referees can view history from the scoreboard.
 */
export function canViewMatchHistory(role: UserRole): boolean {
  return role === 'referee'
}