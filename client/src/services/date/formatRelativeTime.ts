/**
 * Date formatting utilities
 *
 * Pure functions for formatting dates and timestamps.
 * No React dependencies - testable in isolation.
 */

/**
 * Format a timestamp as a relative time string (Spanish).
 * e.g., "recién", "hace 5m", "hace 2h", or full date.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'recién'
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`

  return new Date(timestamp).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
