/**
 * Scoreboard authorization hook
 * Derives UI flags from URL path and user role for the scoreboard context
 *
 * Returns:
 * - isReferee: true if user is a referee
 * - canEdit: true if user can edit the score (referee + in referee mode)
 * - canConfigure: true if user can configure the match (referee + not live)
 * - canViewHistory: true if user can view match history (referee only)
 *
 * @deprecated Use usePermissions() or useCan() instead.
 * This hook is maintained for backward compatibility.
 */

import { useAuthContext } from '@/contexts/AuthContext'
import { useScoreboardMode } from './useScoreboardMode'
import {
  canEditScoreboard,
  canConfigureMatch,
  canViewMatchHistory,
} from '@/services/permissions/rules/scoreboard'

export interface ScoreboardAuth {
  isReferee: boolean
  canEdit: boolean
  canConfigure: boolean
  canViewHistory: boolean
}

export function useScoreboardAuth(): ScoreboardAuth {
  const { role, isReferee, isOwner } = useAuthContext()
  const { mode } = useScoreboardMode()

  // Determine effective role for permission checks
  const effectiveRole = isOwner ? 'owner' : isReferee ? 'referee' : role
  const scoreboardMode = mode ?? 'view'

  return {
    isReferee,
    canEdit: canEditScoreboard(effectiveRole, scoreboardMode),
    canConfigure: canConfigureMatch(effectiveRole, scoreboardMode),
    canViewHistory: canViewMatchHistory(effectiveRole),
  }
}