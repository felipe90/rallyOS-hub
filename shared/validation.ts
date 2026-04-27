/**
 * Shared validation rules
 *
 * Single source of truth for validation constraints used by both
 * client and server. Prevents drift between front-end and back-end rules.
 */

/**
 * PIN validation rules
 */
export const PIN_RULES = {
  /** Owner PIN: exactly 8 digits */
  ownerPin: {
    pattern: /^\d{8}$/,
    minLength: 8,
    maxLength: 8,
    description: '8-digit tournament owner PIN',
  },
  /** Table PIN: exactly 4 digits */
  tablePin: {
    pattern: /^\d{4}$/,
    minLength: 4,
    maxLength: 4,
    description: '4-digit table referee PIN',
  },
} as const

/**
 * Player name validation rules
 */
export const PLAYER_NAME_RULES = {
  maxLength: 50,
  /** HTML tags are stripped on the server side */
  disallowHtml: true,
} as const

/**
 * Table name validation rules
 */
export const TABLE_NAME_RULES = {
  maxLength: 256,
} as const

/**
 * Validate a PIN against its rules.
 * Returns true if the PIN is valid.
 */
export function isValidPin(pin: string, type: 'ownerPin' | 'tablePin'): boolean {
  const rules = PIN_RULES[type]
  return rules.pattern.test(pin)
}

/**
 * Sanitize a player name by stripping HTML tags and truncating.
 */
export function sanitizePlayerName(name: string): string {
  return name
    .replace(/<[^>]*>/g, '')
    .slice(0, PLAYER_NAME_RULES.maxLength)
}
