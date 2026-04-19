/**
 * Granular permission check hook
 *
 * useCan('action', 'domain') returns true if user has permission.
 * Example: useCan('edit', 'scoreboard') → boolean
 */

import { usePermissions } from './usePermissions'

type PermissionAction = 'edit' | 'configure' | 'viewHistory' | 'createTable' | 'viewPin' | 'viewQr'
type PermissionDomain = 'scoreboard' | 'dashboard'

// Mapping from action/domain to permission key
const ACTION_TO_KEY: Record<PermissionDomain, Partial<Record<PermissionAction, string>>> = {
  scoreboard: {
    edit: 'canEdit',
    configure: 'canConfigure',
    viewHistory: 'canViewHistory',
  },
  dashboard: {
    createTable: 'canCreateTable',
    viewPin: 'showPinColumn',
    viewQr: 'showQrColumn',
  },
}

/**
 * Check if user has a specific permission.
 *
 * @param action - The action to check (edit, configure, viewHistory, etc.)
 * @param domain - The domain (scoreboard, dashboard)
 * @returns true if user has permission, false otherwise
 */
export function useCan(action: PermissionAction, domain: PermissionDomain): boolean {
  const permissions = usePermissions()

  const domainPerms = permissions[domain]
  const key = ACTION_TO_KEY[domain]?.[action]

  if (!domainPerms || !key) {
    return false
  }

  return Boolean(domainPerms[key as keyof typeof domainPerms])
}