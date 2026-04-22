/**
 * Dashboard statistics calculation
 *
 * Pure functions for aggregating dashboard metrics.
 * No React dependencies - testable in isolation.
 */

import type { TableInfo } from '@shared/types'

export interface DashboardStats {
  totalTables: number
  liveMatches: number
  activePlayers: number
}

/**
 * Calculate dashboard statistics from a list of tables.
 */
export function calculateDashboardStats(tables: TableInfo[]): DashboardStats {
  return {
    totalTables: tables.length,
    liveMatches: tables.filter(
      t => t.status === 'LIVE' || t.status === 'CONFIGURING',
    ).length,
    activePlayers: tables.reduce((acc, t) => {
      const hasPlayers = t.playerNames?.a || t.playerNames?.b
      return acc + (hasPlayers ? 2 : t.playerCount || 0)
    }, 0),
  }
}
