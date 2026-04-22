import { describe, it, expect } from 'vitest'
import { calculateDashboardStats } from './calculateStats'
import type { TableInfo } from '@shared/types'

describe('calculateDashboardStats', () => {
  it('returns zeros for empty tables', () => {
    expect(calculateDashboardStats([])).toEqual({
      totalTables: 0,
      liveMatches: 0,
      activePlayers: 0,
    })
  })

  it('counts total tables', () => {
    const tables: TableInfo[] = [
      { id: '1', number: 1, name: 'T1', status: 'WAITING', playerCount: 0 },
      { id: '2', number: 2, name: 'T2', status: 'LIVE', playerCount: 2 },
    ]
    expect(calculateDashboardStats(tables).totalTables).toBe(2)
  })

  it('counts live and configuring as live matches', () => {
    const tables: TableInfo[] = [
      { id: '1', number: 1, name: 'T1', status: 'WAITING', playerCount: 0 },
      { id: '2', number: 2, name: 'T2', status: 'LIVE', playerCount: 2 },
      { id: '3', number: 3, name: 'T3', status: 'CONFIGURING', playerCount: 0 },
      { id: '4', number: 4, name: 'T4', status: 'FINISHED', playerCount: 0 },
    ]
    expect(calculateDashboardStats(tables).liveMatches).toBe(2)
  })

  it('counts 2 active players when playerNames exist', () => {
    const tables: TableInfo[] = [
      { id: '1', number: 1, name: 'T1', status: 'LIVE', playerCount: 0, playerNames: { a: 'A', b: 'B' } },
    ]
    expect(calculateDashboardStats(tables).activePlayers).toBe(2)
  })

  it('falls back to playerCount when no playerNames', () => {
    const tables: TableInfo[] = [
      { id: '1', number: 1, name: 'T1', status: 'LIVE', playerCount: 3 },
    ]
    expect(calculateDashboardStats(tables).activePlayers).toBe(3)
  })

  it('sums players across multiple tables', () => {
    const tables: TableInfo[] = [
      { id: '1', number: 1, name: 'T1', status: 'LIVE', playerCount: 0, playerNames: { a: 'A', b: 'B' } },
      { id: '2', number: 2, name: 'T2', status: 'LIVE', playerCount: 4 },
    ]
    expect(calculateDashboardStats(tables).activePlayers).toBe(6)
  })
})
