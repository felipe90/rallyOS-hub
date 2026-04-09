import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMatchDisplay } from './useMatchDisplay'
import type { MatchStateExtended } from '../../shared/types'

const createMockMatch = (overrides: Partial<MatchStateExtended> = {}): MatchStateExtended => ({
  tableId: 'table-1',
  tableName: 'Table 1',
  playerNames: { a: 'Player A', b: 'Player B' },
  history: [],
  undoAvailable: false,
  config: {
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
  },
  score: {
    sets: { a: 0, b: 0 },
    currentSet: { a: 0, b: 0 },
    serving: 'A',
  },
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
  ...overrides,
})

describe('useMatchDisplay', () => {
  describe('sets calculation', () => {
    it('calculates setsA correctly', () => {
      const match = createMockMatch({
        setHistory: [
          { a: 11, b: 5 },
          { a: 8, b: 11 },
          { a: 11, b: 9 },
        ],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setsA).toBe(2)
    })

    it('calculates setsB correctly', () => {
      const match = createMockMatch({
        setHistory: [
          { a: 11, b: 5 },
          { a: 8, b: 11 },
          { a: 11, b: 9 },
        ],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setsB).toBe(1)
    })
  })

  describe('set winner detection', () => {
    it('detects set winner at 11 points with 2 point lead', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 11, b: 5 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setWinner).toBe('A')
    })

    it('detects set winner at deuce (11-10 with 1 point lead)', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 11, b: 10 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setWinner).toBe('A')
    })

    it('does NOT detect winner when score is 10-10 (deuce)', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 10, b: 10 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setWinner).toBeNull()
    })

    it('detects winner in extended deuce with 2 point lead (13-11)', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 13, b: 11 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setWinner).toBe('A')
    })
  })

  describe('match winner detection', () => {
    it('detects match winner with bestOf=3 (first to 2 sets)', () => {
      const match = createMockMatch({
        config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        setHistory: [
          { a: 11, b: 5 },
          { a: 11, b: 8 },
        ],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.matchWinner).toBe('A')
      expect(result.current.isMatchOver).toBe(true)
    })

    it('detects match winner with bestOf=5 (first to 3 sets)', () => {
      const match = createMockMatch({
        config: { pointsPerSet: 11, bestOf: 5, minDifference: 2 },
        setHistory: [
          { a: 11, b: 5 },
          { a: 11, b: 8 },
          { a: 11, b: 9 },
        ],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.totalSets).toBe(5)
      expect(result.current.matchWinner).toBe('A')
    })

    it('no match winner when sets are tied', () => {
      const match = createMockMatch({
        config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        setHistory: [
          { a: 11, b: 5 },
        ],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.matchWinner).toBeNull()
    })
  })

  describe('side swap (ITTF rules)', () => {
    it('applies swap when swappedSides is true', () => {
      const match = createMockMatch({
        swappedSides: true,
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.isSwapped).toBe(true)
      expect(result.current.leftPlayer).toBe('B')
      expect(result.current.rightPlayer).toBe('A')
    })

    it('does NOT swap when swappedSides is false', () => {
      const match = createMockMatch({
        swappedSides: false,
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.isSwapped).toBe(false)
      expect(result.current.leftPlayer).toBe('A')
      expect(result.current.rightPlayer).toBe('B')
    })
  })

  describe('player names with swap', () => {
    it('swaps names when sides are swapped', () => {
      const match = createMockMatch({
        swappedSides: true,
        playerNames: { a: 'Player A', b: 'Player B' },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftName).toBe('Player B')
      expect(result.current.rightName).toBe('Player A')
    })

    it('keeps original names when not swapped', () => {
      const match = createMockMatch({
        swappedSides: false,
        playerNames: { a: 'Player A', b: 'Player B' },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftName).toBe('Player A')
      expect(result.current.rightName).toBe('Player B')
    })
  })

  describe('handicap handling', () => {
    it('applies handicaps correctly when not swapped', () => {
      const match = createMockMatch({
        config: {
          pointsPerSet: 11,
          bestOf: 3,
          minDifference: 2,
          handicapA: 2,
          handicapB: 0,
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftHandicap).toBe(2)
      expect(result.current.rightHandicap).toBe(0)
    })

    it('swaps handicaps when sides are swapped', () => {
      const match = createMockMatch({
        swappedSides: true,
        config: {
          pointsPerSet: 11,
          bestOf: 3,
          minDifference: 2,
          handicapA: 2,
          handicapB: 1,
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftHandicap).toBe(1)
      expect(result.current.rightHandicap).toBe(2)
    })

    it('handles undefined handicaps', () => {
      const match = createMockMatch({
        config: {
          pointsPerSet: 11,
          bestOf: 3,
          minDifference: 2,
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftHandicap).toBeUndefined()
      expect(result.current.rightHandicap).toBeUndefined()
    })
  })

  describe('serving player detection', () => {
    it('detects A serving when not swapped', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftServing).toBe(true)
      expect(result.current.rightServing).toBe(false)
    })

    it('detects B serving when not swapped', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'B',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftServing).toBe(false)
      expect(result.current.rightServing).toBe(true)
    })

    it('swaps serving indicator when sides are swapped', () => {
      const match = createMockMatch({
        swappedSides: true,
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftServing).toBe(false)
      expect(result.current.rightServing).toBe(true)
    })
  })

  describe('memoization', () => {
    it('returns same reference for same input', () => {
      const match = createMockMatch()

      const { result, rerender } = renderHook(() => useMatchDisplay(match))

      const firstResult = result.current

      rerender()

      const secondResult = result.current

      expect(firstResult).toBe(secondResult)
    })

    it('updates when match changes', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 0, b: 0 },
          serving: 'A',
        },
      })

      const { result, rerender } = renderHook(({ match }) => useMatchDisplay(match), {
        initialProps: { match },
      })

      expect(result.current.leftScore).toBe(0)

      const matchUpdated = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      })

      rerender({ match: matchUpdated })

      expect(result.current.leftScore).toBe(5)
    })
  })

  describe('edge cases', () => {
    it('handles undefined playerNames', () => {
      const match = createMockMatch({
        playerNames: undefined as any,
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.leftName).toBeUndefined()
      expect(result.current.rightName).toBeUndefined()
    })

    it('handles match in progress (no set winner)', () => {
      const match = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
        status: 'LIVE',
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setWinner).toBeNull()
      expect(result.current.isMatchOver).toBe(false)
    })

    it('handles match finished status', () => {
      const match = createMockMatch({
        status: 'FINISHED',
        setHistory: [
          { a: 11, b: 5 },
          { a: 11, b: 8 },
        ],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.isMatchOver).toBe(true)
      expect(result.current.phaseLabel).toBe('final')
    })

    it('handles WAITING status', () => {
      const match = createMockMatch({
        status: 'WAITING',
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.phaseLabel).toBe('quarterfinal')
    })

    it('handles custom pointsPerSet', () => {
      const match = createMockMatch({
        config: {
          pointsPerSet: 21,
          bestOf: 3,
          minDifference: 2,
        },
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 21, b: 15 },
          serving: 'A',
        },
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setWinner).toBe('A')
    })

    it('handles empty setHistory', () => {
      const match = createMockMatch({
        setHistory: [],
      })

      const { result } = renderHook(() => useMatchDisplay(match))

      expect(result.current.setsA).toBe(0)
      expect(result.current.setsB).toBe(0)
    })
  })
})
