/**
 * URL building
 *
 * Pure functions for constructing application URLs.
 * No React dependencies - testable in isolation.
 *
 * Uses AES-256-GCM encryption for PINs (compatible with server).
 */

import { encryptPin } from '@/shared/crypto/pinEncryption'

/**
 * Get the encryption secret from environment.
 */
function getEncryptionSecret(): string {
  const secret = import.meta.env.VITE_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('VITE_ENCRYPTION_SECRET is required for PIN encryption')
  }
  return secret
}

/**
 * Build a scoreboard URL for a referee to join a table.
 * Returns a Promise since encryption is async (Web Crypto API).
 */
export async function buildScoreboardUrl(tableId: string, pin: string): Promise<string> {
  const secret = getEncryptionSecret()
  const encryptedPin = await encryptPin(pin, tableId, secret)
  return `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`
}

/**
 * Build a table URL for spectators.
 */
export function buildTableUrl(tableId: string): string {
  return `${window.location.origin}/scoreboard/${tableId}/view`
}
