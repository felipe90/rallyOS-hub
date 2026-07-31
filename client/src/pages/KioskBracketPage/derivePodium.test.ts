import { describe, it, expect } from 'vitest'
import { derivePodium } from './derivePodium'
import { BRACKET_STATUS, BRACKET_MATCH_STATUS } from '@shared/types'
import type { TournamentBracket, BracketMatch } from '@shared/types'

/** Build a match with sensible defaults (status derived from winner presence). */
function match(overrides: Partial<BracketMatch> & { id: string; round: number; position: number }): BracketMatch {
  const winner = overrides.winner ?? null
  const status = overrides.status ?? (winner ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.PENDING)
  return {
    playerA: null,
    playerB: null,
    courtId: null,
    ...overrides,
    status,
  } as BracketMatch
}

/**
 * Build a completed 4-slot bracket. R1 has two matches (both completed, feeding
 * the final), R2-M1 is the final. `finalWinner`/`finalLoser` populate the
 * final; the two semifinal winners are filler. Pass `withThirdPlace` + the
 * third-place result to append a completed thirdPlaceMatch.
 */
function completedBracket4(opts: {
  champion: string | null
  runnerUp: string | null
  withThirdPlace?: boolean
  thirdPlace?: string | null
  thirdPlaceLoser?: string | null
}): TournamentBracket {
  const finalMatch = match({
    id: 'R2-M1',
    round: 2,
    position: 0,
    playerA: opts.champion,
    playerB: opts.runnerUp,
    winner: opts.champion ? 'A' : 'B',
    status: BRACKET_MATCH_STATUS.COMPLETED,
  })

  const semi1 = match({
    id: 'R1-M1',
    round: 1,
    position: 0,
    playerA: opts.champion,
    playerB: 'Semi Finalist 1',
    winner: 'A',
    status: BRACKET_MATCH_STATUS.COMPLETED,
  })
  const semi2 = match({
    id: 'R1-M2',
    round: 1,
    position: 1,
    playerA: opts.runnerUp,
    playerB: 'Semi Finalist 2',
    winner: opts.runnerUp ? 'A' : 'B',
    status: BRACKET_MATCH_STATUS.COMPLETED,
  })

  const thirdPlaceMatch =
    opts.withThirdPlace === true
      ? match({
          id: 'TP-M1',
          round: 3,
          position: 0,
          playerA: opts.thirdPlace ?? null,
          playerB: opts.thirdPlaceLoser ?? null,
          winner: opts.thirdPlace ? 'A' : null,
          status: opts.thirdPlace ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.READY,
        })
      : null

  return {
    name: 'Torneo',
    numSlots: 4,
    includeThirdPlace: opts.withThirdPlace === true,
    matches: [semi1, semi2, finalMatch],
    thirdPlaceMatch,
    status: BRACKET_STATUS.COMPLETED,
    createdAt: 1000,
  }
}

describe('derivePodium', () => {
  it('returns null when bracket is null', () => {
    expect(derivePodium(null)).toBeNull()
  })

  it('returns null when bracket status is SETUP', () => {
    const b = completedBracket4({ champion: 'Champ', runnerUp: 'Runner' })
    b.status = BRACKET_STATUS.SETUP
    expect(derivePodium(b)).toBeNull()
  })

  it('returns null when bracket status is ACTIVE', () => {
    const b = completedBracket4({ champion: 'Champ', runnerUp: 'Runner' })
    b.status = BRACKET_STATUS.ACTIVE
    expect(derivePodium(b)).toBeNull()
  })

  it('derives champion + runnerUp when COMPLETED (no third place)', () => {
    const b = completedBracket4({ champion: 'Champ', runnerUp: 'Runner' })
    const podium = derivePodium(b)
    expect(podium).not.toBeNull()
    expect(podium!.champion).toBe('Champ')
    expect(podium!.runnerUp).toBe('Runner')
    expect(podium!.thirdPlace).toBeNull()
  })

  it('derives thirdPlace when the third-place match is completed', () => {
    const b = completedBracket4({
      champion: 'Champ',
      runnerUp: 'Runner',
      withThirdPlace: true,
      thirdPlace: 'Third',
      thirdPlaceLoser: 'Fourth',
    })
    const podium = derivePodium(b)
    expect(podium).not.toBeNull()
    expect(podium!.champion).toBe('Champ')
    expect(podium!.runnerUp).toBe('Runner')
    expect(podium!.thirdPlace).toBe('Third')
  })

  it('thirdPlace is null when the third-place match exists but is not completed', () => {
    const b = completedBracket4({
      champion: 'Champ',
      runnerUp: 'Runner',
      withThirdPlace: true,
      thirdPlace: null,
      thirdPlaceLoser: null,
    })
    const podium = derivePodium(b)
    expect(podium).not.toBeNull()
    expect(podium!.thirdPlace).toBeNull()
  })

  it('runnerUp is null when the final was a bye (one finalist absent)', () => {
    const b = completedBracket4({ champion: 'Champ', runnerUp: null })
    const podium = derivePodium(b)
    expect(podium).not.toBeNull()
    expect(podium!.champion).toBe('Champ')
    expect(podium!.runnerUp).toBeNull()
  })

  it('returns null when status is COMPLETED but the final has no winner (defensive)', () => {
    const b = completedBracket4({ champion: 'Champ', runnerUp: 'Runner' })
    const finalMatch = b.matches.find((m) => m.id === 'R2-M1')!
    finalMatch.winner = null
    finalMatch.status = BRACKET_MATCH_STATUS.READY
    // status claims COMPLETED but the final is not actually decided
    b.status = BRACKET_STATUS.COMPLETED
    expect(derivePodium(b)).toBeNull()
  })

  it('works for an 8-slot bracket (final at round 3)', () => {
    // Final at round 3, position 0.
    const finalMatch = match({
      id: 'R3-M1',
      round: 3,
      position: 0,
      playerA: 'Ace',
      playerB: 'Beto',
      winner: 'B',
      status: BRACKET_MATCH_STATUS.COMPLETED,
    })
    const filler = (id: string, round: number, position: number): BracketMatch =>
      match({ id, round, position, playerA: 'x', playerB: 'y', winner: 'A', status: BRACKET_MATCH_STATUS.COMPLETED })
    const b: TournamentBracket = {
      name: 'T8',
      numSlots: 8,
      includeThirdPlace: false,
      matches: [
        filler('R1-M1', 1, 0),
        filler('R1-M2', 1, 1),
        filler('R1-M3', 1, 2),
        filler('R1-M4', 1, 3),
        filler('R2-M1', 2, 0),
        filler('R2-M2', 2, 1),
        finalMatch,
      ],
      thirdPlaceMatch: null,
      status: BRACKET_STATUS.COMPLETED,
      createdAt: 1,
    }
    const podium = derivePodium(b)
    expect(podium).not.toBeNull()
    expect(podium!.champion).toBe('Beto')
    expect(podium!.runnerUp).toBe('Ace')
    expect(podium!.thirdPlace).toBeNull()
  })
})
