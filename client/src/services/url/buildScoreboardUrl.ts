/**
 * URL building
 *
 * Pure functions for constructing application URLs.
 * No React dependencies - testable in isolation.
 *
 * Note: PIN encryption for QR URLs is handled server-side only.
 * The ENCRYPTION_SECRET never leaves the server. Client-side crypto
 * was removed to eliminate VITE_ENCRYPTION_SECRET exposure in the JS bundle.
 */

/**
 * Build a scoreboard URL for a referee to join a table.
 */
export function buildScoreboardUrl(tableId: string, pin: string): string {
  return `${window.location.origin}/scoreboard/${tableId}/referee?pin=${pin}`
}

/**
 * Build a table URL for spectators.
 */
export function buildTableUrl(tableId: string): string {
  return `${window.location.origin}/scoreboard/${tableId}/view`
}
