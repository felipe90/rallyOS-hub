/**
 * Dashboard permission rules
 *
 * Pure functions for dashboard authorization.
 * No React dependencies - testable in isolation.
 */

import type { UserRole } from '@/contexts/AuthContext/AuthContext.types'

/**
 * Determine if user can create new tables.
 * Only the tournament owner can create tables.
 */
export function canCreateTable(role: UserRole): boolean {
  return role === 'owner'
}

/**
 * Determine if PIN column should be visible.
 * Only owner can see PINs.
 */
export function shouldShowPinColumn(role: UserRole): boolean {
  return role === 'owner'
}

/**
 * Determine if QR code column should be visible.
 * Only owner can see QR codes.
 */
export function shouldShowQrColumn(role: UserRole): boolean {
  return role === 'owner'
}