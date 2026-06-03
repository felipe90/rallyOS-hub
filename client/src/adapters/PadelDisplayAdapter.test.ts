import { describe, it, expect, vi } from 'vitest'
import { SPORT } from '@shared/types'
import { PadelDisplayAdapter } from './PadelDisplayAdapter'
import type { MatchStateExtended, Score } from '@shared/types'

vi.mock('../i18n', () => ({
  i18nText: (key: string) => key,
}))

function createPadelState(overrides: Partial<MatchStateExtended> = {}): MatchStateExtended {
  return {
    tableId: 'table-1',
    tableName: 'Court 1',
    playerNames: { a: 'Alice', b: 'Bob' },
    history: [],
    undoAvailable: false,
    config: {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
      goldenPoint: false,
    },
    sport: SPORT.PADEL,
    swappedSides: false,
    midSetSwapped: false,
    status: 'LIVE',
    winner: null,
    // Padel-specific fields
    padelPoints: { a: 15, b: 30 },
    games: { a: 2, b: 1 },
    sets: { a: 0, b: 0 },
    isTiebreak: false,
    tiebreakPoints: { a: 0, b: 0 },
    tiebreakTarget: 7,
    goldenPoint: false,
    serving: 'A',
    setHistory: [
      { a: 6, b: 4 },
      { a: 3, b: 6 },
      { a: 6, b: 2 },
    ],
    ...overrides,
  } as any as MatchStateExtended
}

describe('PadelDisplayAdapter', () => {
  const adapter = new PadelDisplayAdapter()

  describe('sport', () => {
    it('identifies as padel', () => {
      expect(adapter.sport).toBe(SPORT.PADEL)
    })
  })

  describe('computeDisplayData', () => {
    it('extracts padelPoints as strings', () => {
      const state = createPadelState({ padelPoints: { a: 15, b: 30 } })

      const result = adapter.computeDisplayData(state)
      expect(result.type).toBe(SPORT.PADEL)
      expect(result.leftPoint).toBe('15')
      expect(result.rightPoint).toBe('30')
    })

    it('extracts games count', () => {
      const state = createPadelState({ games: { a: 3, b: 2 } })

      const result = adapter.computeDisplayData(state)
      expect(result.leftGames).toBe(3)
      expect(result.rightGames).toBe(2)
    })

    it('extracts sets count from setHistory', () => {
      const state = createPadelState({
        setHistory: [
          { a: 6, b: 4 },
          { a: 6, b: 3 },
        ],
      })

      const result = adapter.computeDisplayData(state)
      expect(result.leftSets).toBe(2)
      expect(result.rightSets).toBe(0)
    })

    it('renders AD as "AD"', () => {
      const state = createPadelState({ padelPoints: { a: 'AD' as any, b: 40 } })

      const result = adapter.computeDisplayData(state)
      expect(result.leftPoint).toBe('AD')
      expect(result.rightPoint).toBe('40')
    })

    it('renders 0 as "0"', () => {
      const state = createPadelState({ padelPoints: { a: 0, b: 0 } })

      const result = adapter.computeDisplayData(state)
      expect(result.leftPoint).toBe('0')
      expect(result.rightPoint).toBe('0')
    })

    it('handles missing padelPoints gracefully', () => {
      const state = createPadelState({ padelPoints: undefined as any })

      const result = adapter.computeDisplayData(state)
      expect(result.leftPoint).toBe('0')
      expect(result.rightPoint).toBe('0')
    })
  })

  describe('getCurrentScores', () => {
    it('returns games as current scores (not points)', () => {
      const state = createPadelState({ games: { a: 4, b: 3 } })

      const result = adapter.getCurrentScores(state)
      expect(result.a).toBe(4)
      expect(result.b).toBe(3)
    })
  })

  describe('getServing', () => {
    it('returns top-level serving from padel state', () => {
      const state = createPadelState({ serving: 'B' as any })
      expect(adapter.getServing(state)).toBe('B')
    })
  })

  describe('needsHandicap', () => {
    it('returns false for padel', () => {
      expect(adapter.needsHandicap()).toBe(false)
    })
  })

  describe('DisplayComponent', () => {
    it('is the PadelPointDisplay component', () => {
      expect(typeof adapter.DisplayComponent).toBe('function')
    })
  })

  describe('validateConfig', () => {
    it('accepts valid padel config', () => {
      const errors = adapter.validateConfig({
        sport: SPORT.PADEL,
        tiebreakPoints: 7,
        gamesPerSet: 6,
        goldenPoint: false,
      })
      expect(errors).toEqual([])
    })

    it('accepts super tiebreak (10 points)', () => {
      const errors = adapter.validateConfig({ tiebreakPoints: 10 })
      expect(errors).toEqual([])
    })

    it('rejects invalid tiebreak value (5)', () => {
      const errors = adapter.validateConfig({ tiebreakPoints: 5 })
      expect(errors.some(e => e.includes('tiebreakPoints'))).toBe(true)
    })

    it('rejects invalid tiebreak value (11)', () => {
      const errors = adapter.validateConfig({ tiebreakPoints: 11 })
      expect(errors.some(e => e.includes('tiebreakPoints'))).toBe(true)
    })

    it('rejects gamesPerSet below 1', () => {
      const errors = adapter.validateConfig({ gamesPerSet: 0 })
      expect(errors.some(e => e.includes('gamesPerSet'))).toBe(true)
    })

    it('accepts gamesPerSet at minimum (1)', () => {
      const errors = adapter.validateConfig({ gamesPerSet: 1 })
      expect(errors).toEqual([])
    })
  })

  describe('getConfigDefaults', () => {
    it('returns standard padel defaults', () => {
      const defaults = adapter.getConfigDefaults()
      expect(defaults.sport).toBe(SPORT.PADEL)
      expect(defaults.bestOf).toBe(3)
      expect(defaults.tiebreakPoints).toBe(7)
      expect(defaults.gamesPerSet).toBe(6)
      expect(defaults.goldenPoint).toBe(false)
    })
  })

  describe('getConfigFields', () => {
    it('returns padel-specific fields (gamesPerSet, tiebreakPoints, goldenPoint)', () => {
      const fields = adapter.getConfigFields()
      const names = fields.map(f => f.name)
      expect(names).toContain('gamesPerSet')
      expect(names).toContain('tiebreakPoints')
      expect(names).toContain('goldenPoint')
    })

    it('tiebreakPoints is a select field with options 7|10', () => {
      const field = adapter.getConfigFields().find(f => f.name === 'tiebreakPoints')!
      expect(field.type).toBe('select')
      expect(field.options).toEqual([
        { value: 7, label: '7 puntos' },
        { value: 10, label: '10 puntos' },
      ])
    })

    it('goldenPoint is a boolean field', () => {
      const field = adapter.getConfigFields().find(f => f.name === 'goldenPoint')!
      expect(field.type).toBe('boolean')
    })

    it('does not include handicap fields', () => {
      const names = adapter.getConfigFields().map(f => f.name)
      expect(names).not.toContain('handicapA')
      expect(names).not.toContain('handicapB')
    })
  })

  describe('formatSetHistory', () => {
    it('converts Score[] to FormattedSet[] with game counts', () => {
      const history: Score[] = [
        { a: 6, b: 4 },
        { a: 3, b: 6 },
        { a: 6, b: 2 },
      ]

      const result = adapter.formatSetHistory(history)
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ left: 6, right: 4, label: 'Set 1' })
      expect(result[1]).toEqual({ left: 3, right: 6, label: 'Set 2' })
      expect(result[2]).toEqual({ left: 6, right: 2, label: 'Set 3' })
    })

    it('returns empty array for empty history', () => {
      const result = adapter.formatSetHistory([])
      expect(result).toEqual([])
    })
  })
})
