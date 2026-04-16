/**
 * Scoreboard authorization hook
 * Derives UI flags from URL path and user role for the scoreboard context
 * 
 * Returns:
 * - isReferee: true if user is a referee
 * - canEdit: true if user can edit the score (referee + in referee mode)
 * - canConfigure: true if user can configure the match (referee + not live)
 * - canViewHistory: true if user can view match history (referee only)
 */

import { useAuthContext } from '@/contexts/AuthContext'
import { useScoreboardMode } from './useScoreboardMode'

export interface ScoreboardAuth {
  isReferee: boolean
  canEdit: boolean
  canConfigure: boolean
  canViewHistory: boolean
}

export function useScoreboardAuth(): ScoreboardAuth {
  const { isReferee, isOwner } = useAuthContext()
  const { isRefereeMode } = useScoreboardMode()

  // Can edit if user is referee OR owner, AND in referee URL mode
  // (owner can arbitrate if needed)
  const canEdit = (isReferee || isOwner) && isRefereeMode

  // Can configure if referee or owner, and in referee mode
  const canConfigure = (isReferee || isOwner) && isRefereeMode

  // Can view history only if referee (even in view mode, 
  // owner might want to see history from spectator view)
  const canViewHistory = isReferee

  return {
    isReferee,
    canEdit,
    canConfigure,
    canViewHistory,
  }
}
