/**
 * Auth form validation
 *
 * Pure functions for validating auth-related inputs.
 * No React dependencies - testable in isolation.
 */

export const MAX_TABLE_NAME_LENGTH = 256

/**
 * Validate a table name.
 */
export function validateTableName(name?: string): boolean {
  if (!name) return true // Optional
  return typeof name === 'string' && name.length <= MAX_TABLE_NAME_LENGTH
}

/**
 * Validate an owner PIN (8 digits).
 */
export function validateOwnerPinInput(pin: string): boolean {
  return /^\d{8}$/.test(pin)
}

/**
 * Validate a referee/viewer name.
 */
export function validatePlayerName(name?: string): boolean {
  if (name === undefined || name === null) return true // Optional
  return typeof name === 'string' && name.length > 0 && name.length <= 50
}
