import { describe, it, expect } from 'vitest'
import { roundNameKey, groupIntoRounds, resolveCourtContext } from './rounds'
import type { TournamentBracket, BracketMatch } from '@shared/types'

function m(round: number, position: number, overrides: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id: `R${round}-M${position + 1}`,
    round,
    position,
    playerA: null,
    playerB: null,
    winner: null,
    status: 'PENDING',
    courtId: null,
    ...overrides,
  }
}

describe('roundNameKey', () => {
  it('maps 4-slot rounds (Semis, Final)', () => {
    expect(roundNameKey(4, 1)).toBe('bracketRoundSemi')
    expect(roundNameKey(4, 2)).toBe('bracketRoundFinal')
  })
  it('maps 8-slot rounds (Cuartos, Semis, Final)', () => {
    expect(roundNameKey(8, 1)).toBe('bracketRoundQuarter')
    expect(roundNameKey(8, 2)).toBe('bracketRoundSemi')
    expect(roundNameKey(8, 3)).toBe('bracketRoundFinal')
  })
  it('maps 16-slot round 1 to R16', () => {
    expect(roundNameKey(16, 1)).toBe('bracketRoundR16')
    expect(roundNameKey(16, 2)).toBe('bracketRoundQuarter')
    expect(roundNameKey(16, 4)).toBe('bracketRoundFinal')
  })
  it('maps 32-slot rounds', () => {
    expect(roundNameKey(32, 1)).toBe('bracketRoundR32')
    expect(roundNameKey(32, 2)).toBe('bracketRoundR16')
    expect(roundNameKey(32, 5)).toBe('bracketRoundFinal')
  })
})

describe('groupIntoRounds', () => {
  const bracket: TournamentBracket = {
    name: 't',
    numSlots: 4,
    includeThirdPlace: false,
    matches: [m(1, 0), m(1, 1), m(2, 0)],
    thirdPlaceMatch: null,
    status: 'SETUP',
    createdAt: 0,
  }
  it('groups matches into totalRounds rounds, sorted by round then position', () => {
    const rounds = groupIntoRounds(bracket)
    expect(rounds).toHaveLength(2)
    expect(rounds[0].matches.map((x) => x.id)).toEqual(['R1-M1', 'R1-M2'])
    expect(rounds[1].matches.map((x) => x.id)).toEqual(['R2-M1'])
  })
  it('uses i18n keys as round names (not display strings)', () => {
    const rounds = groupIntoRounds(bracket)
    expect(rounds[0].name).toBe('bracketRoundSemi')
    expect(rounds[1].name).toBe('bracketRoundFinal')
  })
})

describe('resolveCourtContext', () => {
  it('returns null label when courtId is null', () => {
    const r = resolveCourtContext(m(1, 0, { courtId: null }), [], [])
    expect(r).toEqual({ courtLabel: null, courtOrphan: false, courtOccupied: false })
  })
  it('marks orphan when courtId not in courts list', () => {
    const r = resolveCourtContext(m(1, 0, { courtId: 'ghost' }), [{ id: 'c1', name: 'C1' }], [])
    expect(r.courtOrphan).toBe(true)
    expect(r.courtLabel).toBeNull()
  })
  it('resolves label for a live court', () => {
    const r = resolveCourtContext(m(1, 0, { courtId: 'c1' }), [{ id: 'c1', name: 'Cancha 1' }], [])
    expect(r).toEqual({ courtLabel: 'Cancha 1', courtOrphan: false, courtOccupied: false })
  })
  it('flags courtOccupied when another non-completed match shares the courtId', () => {
    const a = m(1, 0, { courtId: 'c1', status: 'READY' })
    const b = m(1, 1, { courtId: 'c1', status: 'READY' })
    const r = resolveCourtContext(a, [{ id: 'c1', name: 'C1' }], [a, b])
    expect(r.courtOccupied).toBe(true)
  })
  it('does NOT flag courtOccupied when the sharing match is completed', () => {
    const a = m(1, 0, { courtId: 'c1', status: 'READY' })
    const b = m(1, 1, { courtId: 'c1', status: 'COMPLETED' })
    const r = resolveCourtContext(a, [{ id: 'c1', name: 'C1' }], [a, b])
    expect(r.courtOccupied).toBe(false)
  })
})