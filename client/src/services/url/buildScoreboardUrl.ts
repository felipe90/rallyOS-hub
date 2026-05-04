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
 * Falls back to a deterministic dev secret for local development.
 */
function getEncryptionSecret(): string {
  const secret = import.meta.env.VITE_ENCRYPTION_SECRET as string | undefined
  if (!secret) {
    // Dev fallback: use raw PIN if no secret configured
    // (dev.sh handles this properly — this is a safety net)
    console.warn('[QR] VITE_ENCRYPTION_SECRET not set — PIN will NOT be encrypted in URL')
    return ''
  }
  return secret
}

/**
 * Build a scoreboard URL for a referee to join a table.
 * Returns a Promise since encryption is async (Web Crypto API).
 */
export async function buildScoreboardUrl(tableId: string, pin: string): Promise<string> {
  const secret = getEncryptionSecret()
  if (!secret) {
    // No encryption available — use raw PIN (dev only)
    return `${window.location.origin}/scoreboard/${tableId}/referee?pin=${pin}`
  }
  const encryptedPin = await encryptPin(pin, tableId, secret)
  return `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`
}

/**
 * Build a table URL for spectators.
 */
export function buildTableUrl(tableId: string): string {
  return `${window.location.origin}/scoreboard/${tableId}/view`
}
