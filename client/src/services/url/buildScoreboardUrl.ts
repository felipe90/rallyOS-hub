/**
 * URL building
 *
 * Pure functions for constructing application URLs.
 * No React dependencies - testable in isolation.
 */

import { generateKey, encryptPin } from '@/shared/crypto/pinEncryption'

/**
 * Build a scoreboard URL for a referee to join a table.
 */
export function buildScoreboardUrl(tableId: string, pin: string): string {
  const key = generateKey(tableId)
  const encryptedPin = encryptPin(pin, key)
  return `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`
}

/**
 * Build a table URL for spectators.
 */
export function buildTableUrl(tableId: string): string {
  return `${window.location.origin}/scoreboard/${tableId}/view`
}
