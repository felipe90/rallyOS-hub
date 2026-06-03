import { describe, it, expect } from 'vitest'
import { SPORT } from '@shared/types'
import { applySideSwap } from './applySideSwap'
import type { MatchStateExtended } from '@shared/types'
import type { SportDisplayAdapter } from '../../adapters/SportDisplayAdapter'
import type { Sport, SportDisplayScore, MatchConfig, Score, Player } from '@shared/types'

/** Minimal mock adapter that behaves like TableTennisDisplayAdapter */
function createMockAdapter(overrides: Partial<SportDisplayAdapter> = {}): SportDisplayAdapter {
  return {
    sport: SPORT.TABLE_TENNIS,
    computeDisplayData: () => ({ type: SPORT.TABLE_TENNIS, leftScore: 0, rightScore: 0, leftSets: 0, rightSets: 0 }),
    DisplayComponent: (() => null) as any,
    getCurrentScores: (state: any) => ({
      a: state.score?.currentSet?.a ?? 0,
      b: state.score?.currentSet?.b ?? 0,
    }),
    getServing: (state: any) => state.score?.serving ?? 'A',
    needsHandicap: () => true,
    getConfigDefaults: () => ({ sport: SPORT.TABLE_TENNIS }),
    validateConfig: () => [],
    getConfigFields: () => [],
    formatSetHistory: (h: Score[]) => h.map((s, i) => ({ left: s.a, right: s.b, label: `Set ${i + 1}` })),
    ...overrides,
  }
}

const createMatch = (overrides: Partial<MatchStateExtended> = {}): MatchStateExtended => ({
  tableId: 'table-1',
  tableName: 'Table 1',
  playerNames: { a: 'Player A', b: 'Player B' },
  history: [],
  undoAvailable: false,
  config: {
    sport: SPORT.TABLE_TENNIS,
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
    handicapA: 2,
    handicapB: 1,
  } as any,
  score: {
    sets: { a: 1, b: 0 },
    currentSet: { a: 5, b: 3 },
    serving: 'A',
  },
  sport: SPORT.TABLE_TENNIS,
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
  ...overrides,
})

describe('applySideSwap', () => {
  it('keeps original orientation when not swapped', () => {
    const adapter = createMockAdapter()
    const match = createMatch({ swappedSides: false })
    const result = applySideSwap(match, 1, 0, adapter)

    expect(result.leftPlayer).toBe('A')
    expect(result.rightPlayer).toBe('B')
    expect(result.leftName).toBe('Player A')
    expect(result.rightName).toBe('Player B')
    expect(result.leftScore).toBe(5)
    expect(result.rightScore).toBe(3)
    expect(result.leftSets).toBe(1)
    expect(result.rightSets).toBe(0)
    expect(result.leftHandicap).toBe(2)
    expect(result.rightHandicap).toBe(1)
    expect(result.leftServing).toBe(true)
    expect(result.rightServing).toBe(false)
  })

  it('swaps everything when swappedSides is true', () => {
    const adapter = createMockAdapter()
    const match = createMatch({ swappedSides: true })
    const result = applySideSwap(match, 1, 0, adapter)

    expect(result.leftPlayer).toBe('B')
    expect(result.rightPlayer).toBe('A')
    expect(result.leftName).toBe('Player B')
    expect(result.rightName).toBe('Player A')
    expect(result.leftScore).toBe(3)
    expect(result.rightScore).toBe(5)
    expect(result.leftSets).toBe(0)
    expect(result.rightSets).toBe(1)
    expect(result.leftHandicap).toBe(1)
    expect(result.rightHandicap).toBe(2)
    expect(result.leftServing).toBe(false)
    expect(result.rightServing).toBe(true)
  })

  it('swaps serving indicator correctly when B is serving', () => {
    const adapter = createMockAdapter()
    const match = createMatch({
      swappedSides: true,
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 3, b: 5 }, serving: 'B' },
    })
    const result = applySideSwap(match, 0, 0, adapter)

    expect(result.leftServing).toBe(true)  // B is serving, B is on left
    expect(result.rightServing).toBe(false)
  })

  it('handles undefined playerNames gracefully', () => {
    const adapter = createMockAdapter()
    const match = createMatch({
      playerNames: undefined as any,
    })
    const result = applySideSwap(match, 0, 0, adapter)

    expect(result.leftName).toBeUndefined()
    expect(result.rightName).toBeUndefined()
  })

  it('handles undefined handicaps gracefully', () => {
    const adapter = createMockAdapter()
    const match = createMatch({
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
    })
    const result = applySideSwap(match, 0, 0, adapter)

    expect(result.leftHandicap).toBeUndefined()
    expect(result.rightHandicap).toBeUndefined()
  })

  it('no handicap when adapter says needsHandicap is false', () => {
    const adapter = createMockAdapter({ needsHandicap: () => false })
    const match = createMatch()
    const result = applySideSwap(match, 0, 0, adapter)

    expect(result.leftHandicap).toBeUndefined()
    expect(result.rightHandicap).toBeUndefined()
  })

  it('uses adapter.getCurrentScores for score extraction', () => {
    const adapter = createMockAdapter({
      getCurrentScores: () => ({ a: 10, b: 8 }),
    })
    const match = createMatch()
    const result = applySideSwap(match, 0, 0, adapter)

    expect(result.leftScore).toBe(10)
    expect(result.rightScore).toBe(8)
  })
})
