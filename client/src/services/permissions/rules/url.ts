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
 * Get the encryption secret from environment.
 */
function getEncryptionSecret(): string {
  const secret = import.meta.env.VITE_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('VITE_ENCRYPTION_SECRET is required for PIN decryption')
  }
  return secret
}

/**
 * Parse and validate encrypted PIN from URL parameter.
 *
 * The ePin param is base64url-encoded AES-256-GCM encrypted data
 * in format: iv:ciphertext:authTag:timestamp
 *
 * @param ePin - The raw ePin parameter from URL search params
 * @param tableId - The table ID used for key derivation
 * @returns ParsedPin object with pin, isValid, and hasPin flags
 */
export async function parseEncryptedPin(
  ePin: string | null,
  tableId: string,
): Promise<ParsedPin> {
  // No PIN in URL
  if (!ePin) {
    return { pin: null, isValid: false, hasPin: false }
  }

  try {
    const secret = getEncryptionSecret()
    const decrypted = await decryptPin(ePin, tableId, secret)

    if (decrypted) {
      // Valid PIN is exactly 4 digits
      const isValid = /^\d{4}$/.test(decrypted)
      if (isValid) {
        return { pin: decrypted, isValid: true, hasPin: true }
      }
    }
  } catch {
    // Decryption failed - silently ignore
  }

  // Invalid or malformed PIN
  return { pin: null, isValid: false, hasPin: true }
}
