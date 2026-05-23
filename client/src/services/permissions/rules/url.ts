/**
 * URL parsing permission rules
 *
 * Pure functions for URL parameter parsing.
 * No React dependencies - testable in isolation.
 *
 * Uses AES-256-GCM decryption (compatible with server).
 */

import { decryptPin } from '@/shared/crypto/pinEncryption'

export interface ParsedPin {
  pin: string | null
  isValid: boolean
  hasPin: boolean
}

/**
 * DEPRECATED — client-side crypto removed for security.
 * Encryption is now server-side only. ENCRYPTION_SECRET never leaves the server.
 * This module is retained for reference but not imported by any production code.
 * Remove after migration to server-side-only encryption is complete.
 */

/**
 * @deprecated Use server-side decryption via POST /api/tournament/load instead.
 * This function is no longer called by production code and exists only for
 * backward-compatible test coverage.
 */
export async function parseEncryptedPin(
  ePin: string | null,
  tableId: string,
): Promise<ParsedPin> {
  // No PIN in URL
  if (!ePin) {
    return { pin: null, isValid: false, hasPin: false }
  }

  // Client-side decryption is deprecated — encryption is now server-side only.
  // This code path is never reached in production.
  return { pin: null, isValid: false, hasPin: true }
}

export interface ParsedPin {
  pin: string | null
  isValid: boolean
  hasPin: boolean
}
