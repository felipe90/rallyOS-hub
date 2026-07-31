/**
 * Maps a server BRACKET_ERROR `code` (UPPER_SNAKE) to an i18n translation key
 * `bracketError.<camelCase>` (or a canonical alias). Unknown / empty codes fall
 * back to `bracketError.generic`.
 *
 * Pure function — no React, no i18n instance — so it is trivially testable
 * (extract-before-mock). The caller passes the returned key to `i18nText`.
 */

/**
 * Convert `UPPER_SNAKE_CASE` to `camelCase`. Empty input returns `'generic'`
 * so callers always produce a valid translation key.
 */
export function toCamelCase(code: string): string {
  if (!code) return 'generic'
  const parts = code.toLowerCase().split('_').filter(Boolean)
  if (parts.length === 0) return 'generic'
  return parts
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('')
}

/**
 * Codes with an explicit `bracketError.<camel>` key. Anything else falls back
 * to `bracketError.generic`. Both the spec's names and the actual server
 * BracketHandler / BracketEngine codes are listed.
 */
const KNOWN_CAMEL = new Set<string>([
  'unauthorized',
  'invalidName',
  'invalidParams',
  'nameTooLong',
  'courtNotFound',
  'courtAlreadyAssigned',
  'invalidSize',
  'invalidWinner',
  'matchNotReady',
  'matchNotFound',
  'noBracket',
  'resetExpired',
  'invalidToken',
])

export function bracketErrorTranslationKey(code: string): string {
  const camel = toCamelCase(code)
  if (camel === 'generic') return 'bracketError.generic'
  return KNOWN_CAMEL.has(camel) ? `bracketError.${camel}` : 'bracketError.generic'
}