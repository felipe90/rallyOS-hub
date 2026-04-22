/**
 * useDashboardStats - Calculates dashboard statistics
 *
 * Thin wrapper over services/dashboard/calculateStats.
 */

import { useMemo } from 'react'
import type { TableInfo } from '@shared/types'
import { calculateDashboardStats } from '@/services/dashboard'

export function useDashboardStats(tables: TableInfo[]) {
  return useMemo(() => calculateDashboardStats(tables), [tables])
}
