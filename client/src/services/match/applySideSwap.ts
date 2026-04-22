/**
 * Side swap logic (ITTF rules)
 *
 * Pure functions for applying side swap between sets.
 * No React dependencies - testable in isolation.
 */

import type { MatchStateExtended, Player } from '@shared/types'

export interface SwappedDisplay {
  leftPlayer: Player
  rightPlayer: Player
  leftName?: string
  rightName?: string
  leftScore: number
  rightScore: number
  leftSets: number
  rightSets: number
  leftHandicap?: number
  rightHandicap?: number
  leftServing: boolean
  rightServing: boolean
}

/**
 * Apply side swap to match display data.
 * When swappedSides is true, player A appears on the right and B on the left.
 */
export function applySideSwap(
  match: MatchStateExtended,
  setsA: number,
  setsB: number,
): SwappedDisplay {
  const isSwapped = match.swappedSides === true

  const leftPlayer: Player = isSwapped ? 'B' : 'A'
  const rightPlayer: Player = isSwapped ? 'A' : 'B'

  return {
    leftPlayer,
    rightPlayer,
    leftName: isSwapped ? match.playerNames?.b : match.playerNames?.a,
    rightName: isSwapped ? match.playerNames?.a : match.playerNames?.b,
    leftScore: isSwapped ? match.score.currentSet.b : match.score.currentSet.a,
    rightScore: isSwapped ? match.score.currentSet.a : match.score.currentSet.b,
    leftSets: isSwapped ? setsB : setsA,
    rightSets: isSwapped ? setsA : setsB,
    leftHandicap: isSwapped ? match.config?.handicapB : match.config?.handicapA,
    rightHandicap: isSwapped ? match.config?.handicapA : match.config?.handicapB,
    leftServing: isSwapped
      ? match.score.serving === 'B'
      : match.score.serving === 'A',
    rightServing: isSwapped
      ? match.score.serving === 'A'
      : match.score.serving === 'B',
  }
}
