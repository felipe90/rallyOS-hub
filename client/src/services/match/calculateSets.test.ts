import { describe, it, expect } from 'vitest'
import { calculateSetsWon } from './calculateSets'
import type { Score } from '@shared/types'

describe('calculateSetsWon', () => {
  it('returns 0-0 for empty history', () => {
    const result = calculateSetsWon([])
    expect(result).toEqual({ setsA: 0, setsB: 0 })
  })

  it('counts sets won by A', () => {
    const history: Score[] = [
      { a: 11, b: 5 },
      { a: 11, b: 8 },
    ]
    expect(calculateSetsWon(history)).toEqual({ setsA: 2, setsB: 0 })
  })

  it('counts sets won by B', () => {
    const history: Score[] = [
      { a: 5, b: 11 },
      { a: 8, b: 11 },
    ]
    expect(calculateSetsWon(history)).toEqual({ setsA: 0, setsB: 2 })
  })

  it('counts mixed results', () => {
    const history: Score[] = [
      { a: 11, b: 5 },
      { a: 8, b: 11 },
      { a: 11, b: 9 },
    ]
    expect(calculateSetsWon(history)).toEqual({ setsA: 2, setsB: 1 })
  })

  it('handles tie sets (not counted for either)', () => {
    const history: Score[] = [
      { a: 11, b: 5 },
      { a: 10, b: 10 },
    ]
    expect(calculateSetsWon(history)).toEqual({ setsA: 1, setsB: 0 })
  })
})
