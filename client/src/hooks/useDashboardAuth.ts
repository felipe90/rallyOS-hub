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
 *
 * @deprecated Use usePermissions() or useCan() instead.
 * This hook is maintained for backward compatibility.
 */

import { useAuthContext } from '@/contexts/AuthContext'
import {
  canCreateTable,
  shouldShowPinColumn,
  shouldShowQrColumn,
} from '@/services/permissions/rules/dashboard'

export interface DashboardAuth {
  isOwner: boolean
  isReferee: boolean
  canCreateTable: boolean
  showPinColumn: boolean
  showQrColumn: boolean
}

export function useDashboardAuth(): DashboardAuth {
  const { role, isOwner, isReferee } = useAuthContext()

  // Determine effective role for permission checks
  const effectiveRole = isOwner ? 'owner' : isReferee ? 'referee' : role

  return {
    isOwner,
    isReferee,
    canCreateTable: canCreateTable(effectiveRole),
    showPinColumn: shouldShowPinColumn(effectiveRole),
    showQrColumn: shouldShowQrColumn(effectiveRole),
  }
}