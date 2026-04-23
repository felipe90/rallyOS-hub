/**
 * PIN validation
 *
 * Re-exports shared validation rules from shared/validation.ts.
 * Single source of truth — client and server use the same rules.
 */

export {
  PIN_RULES,
  isValidPin,
} from '@shared/validation'

/**
 * Validate a table PIN (4 digits).
 * Uses shared PIN_RULES for consistency with server.
 */
export function validateTablePin(pin: string): boolean {
  return PIN_RULES.tablePin.pattern.test(pin)
}

/**
 * Validate an owner PIN (8 digits).
 * Uses shared PIN_RULES for consistency with server.
 */
export function validateOwnerPin(pin: string): boolean {
  return PIN_RULES.ownerPin.pattern.test(pin)
}

/**
 * Validate a PIN against an expected length.
 */
export function validatePinLength(pin: string, expectedLength: number): boolean {
  return pin.length === expectedLength && /^\d+$/.test(pin)
}
