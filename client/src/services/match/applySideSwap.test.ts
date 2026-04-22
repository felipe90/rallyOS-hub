import { describe, it, expect } from 'vitest'
import { applySideSwap } from './applySideSwap'
import type { MatchStateExtended } from '@shared/types'

const createMatch = (overrides: Partial<MatchStateExtended> = {}): MatchStateExtended => ({
  tableId: 'table-1',
  tableName: 'Table 1',
  playerNames: { a: 'Player A', b: 'Player B' },
  history: [],
  undoAvailable: false,
  config: {
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
    handicapA: 2,
    handicapB: 1,
  },
  score: {
    sets: { a: 1, b: 0 },
    currentSet: { a: 5, b: 3 },
    serving: 'A',
  },
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
  ...overrides,
})

describe('applySideSwap', () => {
  it('keeps original orientation when not swapped', () => {
    const match = createMatch({ swappedSides: false })
    const result = applySideSwap(match, 1, 0)

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
    const match = createMatch({ swappedSides: true })
    const result = applySideSwap(match, 1, 0)

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
    const match = createMatch({
      swappedSides: true,
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 3, b: 5 }, serving: 'B' },
    })
    const result = applySideSwap(match, 0, 0)

    expect(result.leftServing).toBe(true)  // B is serving, B is on left
    expect(result.rightServing).toBe(false)
  })

  it('handles undefined playerNames gracefully', () => {
    const match = createMatch({
      playerNames: undefined as any,
    })
    const result = applySideSwap(match, 0, 0)

    expect(result.leftName).toBeUndefined()
    expect(result.rightName).toBeUndefined()
  })

  it('handles undefined handicaps gracefully', () => {
    const match = createMatch({
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
    })
    const result = applySideSwap(match, 0, 0)

    expect(result.leftHandicap).toBeUndefined()
    expect(result.rightHandicap).toBeUndefined()
  })
})
