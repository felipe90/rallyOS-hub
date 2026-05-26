import { describe, it, expect, vi } from 'vitest'
import { SPORT } from '@shared/types'
import { TableTennisDisplayAdapter } from './TableTennisDisplayAdapter'
import type { MatchStateExtended, Score } from '@shared/types'

vi.mock('../i18n', () => ({
  i18nText: (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      validationPointsPerSetRange: `Puntos por set debe estar entre ${(params as any)?.min} y ${(params as any)?.max}`,
      validationMinDifference: 'Diferencia mínima debe ser al menos 1',
      validationHandicapARange: 'Handicap A debe estar entre 0 y 20',
      validationHandicapBRange: 'Handicap B debe estar entre 0 y 20',
    }
    return map[key] || key
  },
}))

// Helper to create a minimal TT match state for testing
function createTTState(overrides: Partial<MatchStateExtended> = {}): MatchStateExtended {
  return {
    tableId: 'table-1',
    tableName: 'Table 1',
    playerNames: { a: 'Alice', b: 'Bob' },
    history: [],
    undoAvailable: false,
    config: {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    },
    score: {
      sets: { a: 1, b: 0 },
      currentSet: { a: 7, b: 5 },
      serving: 'A',
    },
    sport: SPORT.TABLE_TENNIS,
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [
      { a: 11, b: 5 },
      { a: 8, b: 11 },
      { a: 11, b: 9 },
    ],
    status: 'LIVE',
    winner: null,
    ...overrides,
  } as MatchStateExtended
}

describe('TableTennisDisplayAdapter', () => {
  const adapter = new TableTennisDisplayAdapter()

  describe('sport', () => {
    it('identifies as table tennis', () => {
      expect(adapter.sport).toBe(SPORT.TABLE_TENNIS)
    })
  })

  describe('computeDisplayData', () => {
    it('extracts leftScore/rightScore from currentSet', () => {
      const state = createTTState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      })

      const result = adapter.computeDisplayData(state)
      expect(result.type).toBe(SPORT.TABLE_TENNIS)
      expect(result.leftScore).toBe(5)
      expect(result.rightScore).toBe(3)
    })

    it('includes leftSets/rightSets from setHistory', () => {
      const state = createTTState({
        setHistory: [
          { a: 11, b: 5 },
          { a: 11, b: 9 },
        ],
      })

      const result = adapter.computeDisplayData(state)
      expect(result.leftSets).toBe(2)
      expect(result.rightSets).toBe(0)
    })

    it('handles empty setHistory (0-0 sets)', () => {
      const state = createTTState({ setHistory: [] })

      const result = adapter.computeDisplayData(state)
      expect(result.leftSets).toBe(0)
      expect(result.rightSets).toBe(0)
    })

    it('handles partial set wins (1-1)', () => {
      const state = createTTState({
        setHistory: [
          { a: 11, b: 5 },
          { a: 8, b: 11 },
        ],
      })

      const result = adapter.computeDisplayData(state)
      expect(result.leftSets).toBe(1)
      expect(result.rightSets).toBe(1)
    })
  })

  describe('getCurrentScores', () => {
    it('returns currentSet scores', () => {
      const state = createTTState({
        score: {
          sets: { a: 1, b: 0 },
          currentSet: { a: 10, b: 8 },
          serving: 'B',
        },
      })

      const result = adapter.getCurrentScores(state)
      expect(result.a).toBe(10)
      expect(result.b).toBe(8)
    })

    it('returns 0-0 for fresh match', () => {
      const state = createTTState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 0, b: 0 },
          serving: 'A',
        },
      })

      const result = adapter.getCurrentScores(state)
      expect(result.a).toBe(0)
      expect(result.b).toBe(0)
    })
  })

  describe('getServing', () => {
    it('returns score.serving from TT state', () => {
      const state = createTTState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 3, b: 2 },
          serving: 'B',
        },
      })

      expect(adapter.getServing(state)).toBe('B')
    })

    it('returns A when A is serving', () => {
      const state = createTTState()
      expect(adapter.getServing(state)).toBe('A')
    })
  })

  describe('needsHandicap', () => {
    it('returns true for table tennis', () => {
      expect(adapter.needsHandicap()).toBe(true)
    })
  })

  describe('DisplayComponent', () => {
    it('is the TTPointDisplay component', () => {
      // The DisplayComponent must be a React component (function type)
      expect(typeof adapter.DisplayComponent).toBe('function')
    })
  })

  describe('validateConfig', () => {
    it('accepts valid TT config', () => {
      const errors = adapter.validateConfig({
        sport: SPORT.TABLE_TENNIS,
        pointsPerSet: 11,
        bestOf: 3,
        minDifference: 2,
      })
      expect(errors).toEqual([])
    })

    it('rejects pointsPerSet below minimum', () => {
      const errors = adapter.validateConfig({ pointsPerSet: 0 })
      expect(errors.some(e => e.includes('Puntos por set'))).toBe(true)
    })

    it('rejects pointsPerSet above maximum (99)', () => {
      const errors = adapter.validateConfig({ pointsPerSet: 100 })
      expect(errors.some(e => e.includes('Puntos por set'))).toBe(true)
    })

    it('rejects minDifference below 1', () => {
      const errors = adapter.validateConfig({ minDifference: 0 })
      expect(errors.some(e => e.includes('Diferencia mínima'))).toBe(true)
    })

    it('rejects handicapA below 0', () => {
      const errors = adapter.validateConfig({ handicapA: -1 })
      expect(errors.some(e => e.includes('Handicap A'))).toBe(true)
    })

    it('rejects handicapA above 20', () => {
      const errors = adapter.validateConfig({ handicapA: 21 })
      expect(errors.some(e => e.includes('Handicap A'))).toBe(true)
    })

    it('rejects handicapB below 0', () => {
      const errors = adapter.validateConfig({ handicapB: -5 })
      expect(errors.some(e => e.includes('Handicap B'))).toBe(true)
    })

    it('rejects handicapB above 20', () => {
      const errors = adapter.validateConfig({ handicapB: 30 })
      expect(errors.some(e => e.includes('Handicap B'))).toBe(true)
    })

    it('returns multiple errors at once', () => {
      const errors = adapter.validateConfig({ pointsPerSet: 0, handicapA: -1 })
      expect(errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getConfigDefaults', () => {
    it('returns standard TT defaults', () => {
      const defaults = adapter.getConfigDefaults()
      expect(defaults.sport).toBe(SPORT.TABLE_TENNIS)
      expect(defaults.pointsPerSet).toBe(11)
      expect(defaults.bestOf).toBe(3)
      expect(defaults.minDifference).toBe(2)
    })
  })

  describe('getConfigFields', () => {
    it('returns pointsPerSet field for TT config', () => {
      const fields = adapter.getConfigFields()
      expect(fields.length).toBe(1)

      const names = fields.map(f => f.name)
      expect(names).toContain('pointsPerSet')
      // bestOf and handicap are in the common modal UI, not here
      expect(names).not.toContain('handicapA')
    })

    it('pointsPerSet is a number field with min/max', () => {
      const field = adapter.getConfigFields().find(f => f.name === 'pointsPerSet')!
      expect(field.type).toBe('number')
      expect(field.min).toBe(1)
      expect(field.max).toBe(99)
    })
  })

  describe('formatSetHistory', () => {
    it('converts Score[] to FormattedSet[] with labels', () => {
      const history: Score[] = [
        { a: 11, b: 5 },
        { a: 8, b: 11 },
        { a: 11, b: 9 },
      ]

      const result = adapter.formatSetHistory(history)
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ left: 11, right: 5, label: 'Set 1' })
      expect(result[1]).toEqual({ left: 8, right: 11, label: 'Set 2' })
      expect(result[2]).toEqual({ left: 11, right: 9, label: 'Set 3' })
    })

    it('returns empty array for empty history', () => {
      const result = adapter.formatSetHistory([])
      expect(result).toEqual([])
    })
  })
})
