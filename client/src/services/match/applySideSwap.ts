/**
 * Side swap logic
 *
 * Pure functions for applying side swap between sets.
 * No React dependencies - testable in isolation.
 * Uses SportDisplayAdapter to extract sport-specific state (no branching).
 */

import type { MatchStateExtended, Player, TableTennisMatchConfig } from '@shared/types'
import type { SportDisplayAdapter } from '../../adapters/SportDisplayAdapter'

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
 * Score, serving, and handicap extraction is delegated to the SportDisplayAdapter.
 */
export function applySideSwap(
  match: MatchStateExtended,
  setsA: number,
  setsB: number,
  adapter: SportDisplayAdapter,
): SwappedDisplay {
  const isSwapped = match.swappedSides === true

  const leftPlayer: Player = isSwapped ? 'B' : 'A'
  const rightPlayer: Player = isSwapped ? 'A' : 'B'

  // Delegate score extraction to adapter
  const scores = adapter.getCurrentScores(match)
  const leftScore = isSwapped ? scores.b : scores.a
  const rightScore = isSwapped ? scores.a : scores.b

  // Delegate handicap to adapter
  const needsHandicap = adapter.needsHandicap()
  const ttConfig = match.config as TableTennisMatchConfig
  const leftHandicap = needsHandicap
    ? (isSwapped ? (ttConfig.handicapB) : (ttConfig.handicapA))
    : undefined
  const rightHandicap = needsHandicap
    ? (isSwapped ? (ttConfig.handicapA) : (ttConfig.handicapB))
    : undefined

  // Delegate serving to adapter
  const serving = adapter.getServing(match)

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
