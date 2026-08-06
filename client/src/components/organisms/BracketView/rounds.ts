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
}

/**
 * Resolve a match's court context against the inventory courts list.
 * - `courtId === null` → no court (label null).
 * - courtId refers to a court not in the list → label null (the card falls
 *   back to the generic "Sin cancha"). Inventory courts are archive-only, so
 *   there is no orphan/occupied-warning state (slice 5.2).
 */
export function resolveCourtContext(
  match: BracketMatch,
  courts: { id: string; name: string }[],
  _allMatches: BracketMatch[],
): CourtContext {
  if (match.courtId == null) {
    return { courtLabel: null }
  }
  const found = courts.find((c) => c.id === match.courtId)
  return { courtLabel: found ? found.name : null }
}