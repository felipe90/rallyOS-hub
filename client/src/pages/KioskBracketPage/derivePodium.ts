/**
 * derivePodium — pure helper that extracts the podium (champion / runner-up /
 * third place) from a completed tournament bracket.
 *
 * Extracted from the kiosk bracket page so the derivation is trivially
 * unit-testable without rendering. Mirrors the engine's terminal-match
 * convention: the final match is the one at `round === log2(numSlots)` and
 * `position === 0` (see BracketEngine.recomputeBracketStatus); the third-place
 * match is the standalone `thirdPlaceMatch` generated at creation when
 * `includeThirdPlace` is true (R9).
 *
 * Returns `null` when there is no podium to show (bracket missing, or not yet
 * COMPLETED). When the final was a bye (one finalist absent), `runnerUp` is
 * `null` — the UI renders the champion and omits a runner-up line.
 */

import { BRACKET_STATUS, BRACKET_MATCH_STATUS } from '@shared/types'
import type { TournamentBracket } from '@shared/types'

export interface Podium {
  champion: string | null
  runnerUp: string | null
  thirdPlace: string | null
}

/** Name carried by the winning slot of a match, or null if the slot is empty. */
function winnerName(match: { winner: 'A' | 'B' | null; playerA: string | null; playerB: string | null }): string | null {
  if (!match.winner) return null
  return match.winner === 'A' ? match.playerA : match.playerB
}

/** Name carried by the losing slot of a match, or null if the slot is empty. */
function loserName(match: { winner: 'A' | 'B' | null; playerA: string | null; playerB: string | null }): string | null {
  if (!match.winner) return null
  return match.winner === 'A' ? match.playerB : match.playerA
}

/**
 * Derive the podium from a bracket.
 *
 * @returns `{ champion, runnerUp, thirdPlace }` when the bracket is COMPLETED
 *          and a final winner exists; otherwise `null`.
 */
export function derivePodium(bracket: TournamentBracket | null): Podium | null {
  if (!bracket) return null
  if (bracket.status !== BRACKET_STATUS.COMPLETED) return null

  const totalRounds = Math.log2(bracket.numSlots)
  const finalMatch = bracket.matches.find(
    (m) => m.round === totalRounds && m.position === 0,
  )
  if (!finalMatch || finalMatch.status !== BRACKET_MATCH_STATUS.COMPLETED || !finalMatch.winner) {
    return null
  }

  const champion = winnerName(finalMatch)
  const runnerUp = loserName(finalMatch)

  let thirdPlace: string | null = null
  const tp = bracket.thirdPlaceMatch
  if (
    tp &&
    tp.status === BRACKET_MATCH_STATUS.COMPLETED &&
    tp.winner
  ) {
    thirdPlace = winnerName(tp)
  }

  return { champion, runnerUp, thirdPlace }
}
