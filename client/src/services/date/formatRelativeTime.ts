/**
 * Date formatting utilities
 *
 * Pure functions for formatting dates and timestamps.
 * Uses i18nText singleton — no React dependencies.
 */

import i18n, { i18nText } from '@/i18n'

/**
 * Format a timestamp as a relative time string.
 * Uses configured locale via i18nText singleton.
 * e.g., "recién", "hace 5m", "hace 2h", or full date.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return i18nText('eventRelativeTimeJustNow')
  if (diff < 3600000) return i18nText('eventRelativeTimeMinutesAgo', { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return i18nText('eventRelativeTimeHoursAgo', { count: Math.floor(diff / 3600000) })

  return new Date(timestamp).toLocaleDateString(i18n.language || 'es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
