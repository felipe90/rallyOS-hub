/**
 * PIN validation
 *
 * Pure functions for validating PIN formats.
 * No React dependencies - testable in isolation.
 */

export const TABLE_PIN_LENGTH = 4
export const OWNER_PIN_LENGTH = 8

/**
 * Validate a table PIN (4 digits).
 */
export function validateTablePin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

/**
 * Validate an owner PIN (8 digits).
 */
export function validateOwnerPin(pin: string): boolean {
  return /^\d{8}$/.test(pin)
}

/**
 * Validate a PIN against an expected length.
 */
export function validatePinLength(pin: string, expectedLength: number): boolean {
  return pin.length === expectedLength && /^\d+$/.test(pin)
}
