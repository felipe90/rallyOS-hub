/**
 * Unified permissions hook
 *
 * Returns all permission states derived from AuthContext.
 * Wraps pure rule functions from services/permissions/rules.
 */

import { useAuthContext } from '@/contexts/AuthContext'
import { useScoreboardMode } from './useScoreboardMode'
import {
  canEditScoreboard,
  canConfigureMatch,
  canViewMatchHistory,
} from '@/services/permissions/rules/scoreboard'
import {
  canCreateTable,
  shouldShowPinColumn,
  shouldShowQrColumn,
} from '@/services/permissions/rules/dashboard'

export interface ScoreboardPermissions {
  canEdit: boolean
  canConfigure: boolean
  canViewHistory: boolean
}

export interface DashboardPermissions {
  canCreateTable: boolean
  showPinColumn: boolean
  showQrColumn: boolean
}

export interface Permissions {
  scoreboard: ScoreboardPermissions
  dashboard: DashboardPermissions
}

/**
 * Unified hook returning all permissions.
 */
export function usePermissions(): Permissions {
  const { role, isOwner, isReferee } = useAuthContext()
  const { mode } = useScoreboardMode()

  const effectiveRole = isOwner ? 'owner' : isReferee ? 'referee' : role

  return {
    scoreboard: {
      canEdit: canEditScoreboard(effectiveRole, mode ?? 'view'),
      canConfigure: canConfigureMatch(effectiveRole, mode ?? 'view'),
      canViewHistory: canViewMatchHistory(effectiveRole),
    },
    dashboard: {
      canCreateTable: canCreateTable(effectiveRole),
      showPinColumn: shouldShowPinColumn(effectiveRole),
      showQrColumn: shouldShowQrColumn(effectiveRole),
    },
  }
}