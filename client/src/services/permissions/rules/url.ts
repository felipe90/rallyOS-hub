/**
 * URL parsing permission rules
 *
 * Pure functions for URL parameter parsing.
 * No React dependencies - testable in isolation.
 */

import { generateKey, decryptPin } from '@/shared/crypto/pinEncryption'

export interface ParsedPin {
  pin: string | null
  isValid: boolean
  hasPin: boolean
}

/**
 * Parse and validate encrypted PIN from URL parameter.
 *
 * The ePin param is base64-encoded as "hex:originalPin" for integrity.
 * This function decodes the base64, extracts the hex portion, and decrypts
 * using the daily XOR key.
 *
 * @param ePin - The raw ePin parameter from URL search params
 * @param tableId - The table ID used for key generation
 * @returns ParsedPin object with pin, isValid, and hasPin flags
 */
export function parseEncryptedPin(
  ePin: string | null,
  tableId: string,
): ParsedPin {
  // No PIN in URL
  if (!ePin) {
    return { pin: null, isValid: false, hasPin: false }
  }

  try {
    // Decode base64: "hex:originalPin"
    const decoded = atob(ePin)
    const parts = decoded.split(':')

    if (parts.length === 2) {
      const [encrypted] = parts
      const key = generateKey(tableId)
      const decrypted = decryptPin(encrypted, key)

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