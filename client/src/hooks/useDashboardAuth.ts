/**
 * Dashboard authorization hook
 * Derives UI flags from user role for the dashboard context
 * 
 * Returns:
 * - isOwner: true if user is the tournament organizer
 * - isReferee: true if user is a referee
 * - canCreateTable: true if user can create new tables (owner only)
 * - showPinColumn: true if PINs should be visible (owner only)
 * - showQrColumn: true if QR codes should be visible (owner only)
 */

import { useAuthContext } from '@/contexts/AuthContext'
import { UserRoles } from '@/contexts/AuthContext/AuthContext.types'

export interface DashboardAuth {
  isOwner: boolean
  isReferee: boolean
  canCreateTable: boolean
  showPinColumn: boolean
  showQrColumn: boolean
}

export function useDashboardAuth(): DashboardAuth {
  const { role, isOwner, isReferee } = useAuthContext()

  // Derive UI flags from role
  // Owner has full dashboard controls
  // Referee and viewer have limited view access
  const canCreateTable = role === UserRoles.OWNER
  const showPinColumn = role === UserRoles.OWNER
  const showQrColumn = role === UserRoles.OWNER

  return {
    isOwner,
    isReferee,
    canCreateTable,
    showPinColumn,
    showQrColumn,
  }
}
