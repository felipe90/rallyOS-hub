import { describe, it, expect } from 'vitest'
import type { AllHistoryEntry } from '@shared/types'

describe('AllHistoryEntry Type', () => {
  it('should support optional handicap field with a and b properties', () => {
    // This test verifies the type allows handicap field
    const entry: AllHistoryEntry = {
      tableId: 'table-1',
      tableName: 'Mesa 1',
      status: 'LIVE',
      playerNames: { a: 'Juan', b: 'María' },
      history: [],
      handicap: { a: 2, b: 0 },
    }

    expect(entry.handicap).toBeDefined()
    expect(entry.handicap?.a).toBe(2)
    expect(entry.handicap?.b).toBe(0)
  })

  it('should allow handicap to be undefined', () => {
    const entry: AllHistoryEntry = {
      tableId: 'table-2',
      tableName: 'Mesa 2',
      status: 'WAITING',
      playerNames: { a: 'Pedro', b: 'Ana' },
      history: [],
      // handicap is optional - not provided
    }

    expect(entry.handicap).toBeUndefined()
  })

  it('should allow partial handicap (only one player)', () => {
    const entry: AllHistoryEntry = {
      tableId: 'table-3',
      tableName: 'Mesa 3',
      status: 'LIVE',
      playerNames: { a: 'Luis', b: 'Sofia' },
      history: [],
      handicap: { a: 3 },
    }

    expect(entry.handicap?.a).toBe(3)
    expect(entry.handicap?.b).toBeUndefined()
  })
})
