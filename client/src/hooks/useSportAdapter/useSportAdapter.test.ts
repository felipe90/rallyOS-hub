import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { SPORT } from '@shared/types'
import { useSportAdapter } from './useSportAdapter'
import type { MatchStateExtended } from '@shared/types'

function createMatch(sport: string, overrides: Partial<MatchStateExtended> = {}): MatchStateExtended {
  return {
    tableId: 'table-1',
    tableName: 'Court 1',
    playerNames: { a: 'A', b: 'B' },
    history: [],
    undoAvailable: false,
    config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
    score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
    sport: sport as any,
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [],
    status: 'LIVE',
    winner: null,
    ...overrides,
  } as any
}

describe('useSportAdapter', () => {
  it('returns TableTennisDisplayAdapter for SPORT.TABLE_TENNIS match', () => {
    const match = createMatch(SPORT.TABLE_TENNIS)
    const { result } = renderHook(() => useSportAdapter(match))
    expect(result.current.sport).toBe(SPORT.TABLE_TENNIS)
    expect(result.current.needsHandicap()).toBe(true)
  })

  it('returns PadelDisplayAdapter for SPORT.PADEL match', () => {
    const match = createMatch(SPORT.PADEL, {
      padelPoints: { a: 0, b: 0 },
      games: { a: 0, b: 0 },
      sets: { a: 0, b: 0 },
      isTiebreak: false,
      tiebreakPoints: { a: 0, b: 0 },
      tiebreakTarget: 7,
      goldenPoint: false,
      serving: 'A',
    } as any)
    const { result } = renderHook(() => useSportAdapter(match))
    expect(result.current.sport).toBe(SPORT.PADEL)
    expect(result.current.needsHandicap()).toBe(false)
  })

  it('defaults to TableTennisDisplayAdapter for match without sport', () => {
    const match = createMatch(undefined as any)
    const { result } = renderHook(() => useSportAdapter(match))
    expect(result.current.sport).toBe(SPORT.TABLE_TENNIS)
  })

  it('re-memoizes on sport change', () => {
    const ttMatch = createMatch(SPORT.TABLE_TENNIS)
    const { result, rerender } = renderHook(
      ({ match }) => useSportAdapter(match),
      { initialProps: { match: ttMatch } },
    )

    const firstAdapter = result.current

    // Re-render with same sport but different score — should keep same instance
    const ttMatchUpdated = createMatch(SPORT.TABLE_TENNIS, {
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'B' },
    })
    rerender({ match: ttMatchUpdated })
    expect(result.current).toBe(firstAdapter) // Same instance

    // Re-render with different sport — should return new adapter
    const padelMatch = createMatch(SPORT.PADEL, {
      padelPoints: { a: 0, b: 0 },
      games: { a: 0, b: 0 },
      sets: { a: 0, b: 0 },
      isTiebreak: false,
      tiebreakPoints: { a: 0, b: 0 },
      tiebreakTarget: 7,
      goldenPoint: false,
      serving: 'A',
    } as any)
    rerender({ match: padelMatch })
    expect(result.current.sport).toBe(SPORT.PADEL)
    expect(result.current).not.toBe(firstAdapter)
  })
})
