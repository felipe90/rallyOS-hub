/**
 * Side swap logic (ITTF rules)
 *
 * Pure functions for applying side swap between sets.
 * No React dependencies - testable in isolation.
 */

import type { MatchStateExtended, Player, TableTennisMatchConfig, PadelMatchConfig } from '@shared/types'
import { isTableTennisStateExtended, SPORT } from '@shared/types'

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
 * Only valid for table tennis matches (score and handicap access).
 */
export function applySideSwap(
  match: MatchStateExtended,
  setsA: number,
  setsB: number,
): SwappedDisplay {
  const isSwapped = match.swappedSides === true
  const isPadel = match.sport === SPORT.PADEL
  const m = match as any

  const leftPlayer: Player = isSwapped ? 'B' : 'A'
  const rightPlayer: Player = isSwapped ? 'A' : 'B'

  // Access score based on discriminated union
  const leftScore = isSwapped
    ? (isPadel ? m.games?.b ?? 0 : m.score?.currentSet?.b ?? 0)
    : (isPadel ? m.games?.a ?? 0 : m.score?.currentSet?.a ?? 0)
  const rightScore = isSwapped
    ? (isPadel ? m.games?.a ?? 0 : m.score?.currentSet?.a ?? 0)
    : (isPadel ? m.games?.b ?? 0 : m.score?.currentSet?.b ?? 0)

  // Handicap only applies to TT config
  const leftHandicap = isSwapped
    ? (isPadel ? undefined : (m.config as TableTennisMatchConfig)?.handicapB)
    : (isPadel ? undefined : (m.config as TableTennisMatchConfig)?.handicapA)
  const rightHandicap = isSwapped
    ? (isPadel ? undefined : (m.config as TableTennisMatchConfig)?.handicapA)
    : (isPadel ? undefined : (m.config as TableTennisMatchConfig)?.handicapB)

  // Serving access based on discriminated union
  const serving = isPadel ? m.serving : m.score?.serving

  return {
    leftPlayer,
    rightPlayer,
    leftName: isSwapped ? match.playerNames?.b : match.playerNames?.a,
    rightName: isSwapped ? match.playerNames?.a : match.playerNames?.b,
    leftScore,
    rightScore,
    leftSets: isSwapped ? setsB : setsA,
    rightSets: isSwapped ? setsA : setsB,
    leftHandicap,
    rightHandicap,
    leftServing: isSwapped ? serving === 'B' : serving === 'A',
    rightServing: isSwapped ? serving === 'A' : serving === 'B',
  }
}
