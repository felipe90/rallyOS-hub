import { describe, it, expect } from 'vitest'
import { determineSetWinner, determineMatchWinner } from './determineWinner'

describe('determineSetWinner', () => {
  it('returns A when A reaches pointsPerSet with lead', () => {
    expect(determineSetWinner(11, 5, 11)).toBe('A')
  })

  it('returns B when B reaches pointsPerSet with lead', () => {
    expect(determineSetWinner(5, 11, 11)).toBe('B')
  })

  it('returns null when neither has reached pointsPerSet', () => {
    expect(determineSetWinner(5, 3, 11)).toBeNull()
  })

  it('returns null when tied at pointsPerSet-1', () => {
    expect(determineSetWinner(10, 10, 11)).toBeNull()
  })

  it('returns A at deuce with 1 point lead (11-10)', () => {
    expect(determineSetWinner(11, 10, 11)).toBe('A')
  })

  it('returns A in extended deuce (13-11)', () => {
    expect(determineSetWinner(13, 11, 11)).toBe('A')
  })

  it('returns null when tied at 11-11', () => {
    expect(determineSetWinner(11, 11, 11)).toBeNull()
  })

  it('works with custom pointsPerSet (21)', () => {
    expect(determineSetWinner(21, 15, 21)).toBe('A')
    expect(determineSetWinner(20, 20, 21)).toBeNull()
  })
})

describe('determineMatchWinner', () => {
  it('returns A when A wins bestOf=3 (2 sets)', () => {
    expect(determineMatchWinner(2, 0, 3)).toBe('A')
  })

  it('returns B when B wins bestOf=3 (2 sets)', () => {
    expect(determineMatchWinner(0, 2, 3)).toBe('B')
  })

  it('returns null when sets are tied in bestOf=3', () => {
    expect(determineMatchWinner(1, 1, 3)).toBeNull()
  })

  it('returns A when A wins bestOf=5 (3 sets)', () => {
    expect(determineMatchWinner(3, 1, 5)).toBe('A')
  })

  it('returns null when not enough sets won', () => {
    expect(determineMatchWinner(1, 0, 3)).toBeNull()
  })
})
