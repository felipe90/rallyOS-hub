/**
 * useDashboardStats - Calculates dashboard statistics
 *
 * Thin wrapper over services/dashboard/calculateStats.
 */

import { useMemo } from 'react'
import type { CourtInfo } from '@shared/types'
import { calculateDashboardStats } from '@/services/dashboard'

export function useDashboardStats(tables: CourtInfo[]) {
  return useMemo(() => calculateDashboardStats(tables), [tables])
}
