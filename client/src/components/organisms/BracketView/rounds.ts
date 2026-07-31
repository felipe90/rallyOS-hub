/**
 * BracketView round-naming — pure helper (extracted from the organism so it is
 * trivially testable without rendering).
 *
 * Mirrors `BracketEngine.roundName` on the server: `playersInRound = numSlots / 2^(r-1)`.
 * Returns an i18n key (`bracketRound*`) rather than a display string.
 */

import type { TournamentBracket, BracketMatch, BracketRound } from '@shared/types'

export function roundNameKey(numSlots: number, round: number): string {
  const playersInRound = numSlots / Math.pow(2, round - 1)
  if (playersInRound === 2) return 'bracketRoundFinal'
  if (playersInRound === 4) return 'bracketRoundSemi'
  if (playersInRound === 8) return 'bracketRoundQuarter'
  return `bracketRoundR${playersInRound}`
}

/** Group flat matches into rounds sorted by round then position (mirrors engine.getRounds). */
export function groupIntoRounds(bracket: TournamentBracket): BracketRound[] {
  const totalRounds = Math.log2(bracket.numSlots)
  const rounds: BracketRound[] = []
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({
      round: r,
      name: roundNameKey(bracket.numSlots, r),
      matches: bracket.matches
        .filter((m) => m.round === r)
        .sort((a, c) => a.position - c.position),
    })
  }
  return rounds
}

/** Per-match court resolution helper. */
export interface CourtContext {
  courtLabel: string | null
  courtOrphan: boolean
  courtOccupied: boolean
}

/**
 * Resolve a match's court context against the owner's tournament courts list.
 * - `courtId === null` → no court (label null).
 * - courtId refers to a court not in the list → orphan.
 * - `courtOccupied` when another non-completed match shares the same courtId.
 */
export function resolveCourtContext(
  match: BracketMatch,
  courts: { id: string; name: string }[],
  allMatches: BracketMatch[],
): CourtContext {
  if (match.courtId == null) {
    return { courtLabel: null, courtOrphan: false, courtOccupied: false }
  }
  const found = courts.find((c) => c.id === match.courtId)
  const courtOccupied =
    match.status !== 'COMPLETED' &&
    allMatches.some(
      (m) =>
        m.id !== match.id &&
        m.courtId !== null &&
        m.courtId === match.courtId &&
        m.status !== 'COMPLETED',
    )
  return {
    courtLabel: found ? found.name : null,
    courtOrphan: !found,
    courtOccupied,
  }
}