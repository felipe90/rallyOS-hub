/**
 * useMatchDisplay - Calculates match display values
 *
 * Thin wrapper over services/match/.
 */

import { useMemo } from 'react'
import type { MatchStateExtended } from '@shared/types'
import {
  calculateSetsWon,
  determineSetWinner,
  determineMatchWinner,
  applySideSwap,
} from '@/services/match'

export interface MatchDisplayState {
  setsA: number
  setsB: number
  totalSets: number
  isSwapped: boolean
  leftPlayer: 'A' | 'B'
  rightPlayer: 'A' | 'B'
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
  phaseLabel: string
  setWinner: 'A' | 'B' | null
  matchWinner: 'A' | 'B' | null
  isMatchOver: boolean
}

export function useMatchDisplay(match: MatchStateExtended): MatchDisplayState {
  return useMemo(() => {
    const { score, status, config, setHistory } = match

    const { setsA, setsB } = calculateSetsWon(setHistory)
    const totalSets = config?.bestOf ? Math.ceil(config.bestOf / 2) * 2 - 1 : 3
    const pointsPerSet = config?.pointsPerSet || 11

    const swapped = applySideSwap(match, setsA, setsB)

    const scoreA = swapped.leftPlayer === 'A' ? score.currentSet.a : score.currentSet.b
    const scoreB = swapped.leftPlayer === 'A' ? score.currentSet.b : score.currentSet.a

    const setWinner = determineSetWinner(scoreA, scoreB, pointsPerSet)
    const matchWinner = determineMatchWinner(setsA, setsB, totalSets)
    const isMatchOver = status === 'FINISHED' || !!matchWinner

    return {
      setsA,
      setsB,
      totalSets,
      isSwapped: match.swappedSides === true,
      leftPlayer: swapped.leftPlayer,
      rightPlayer: swapped.rightPlayer,
      leftName: swapped.leftName,
      rightName: swapped.rightName,
      leftScore: swapped.leftScore,
      rightScore: swapped.rightScore,
      leftSets: swapped.leftSets,
      rightSets: swapped.rightSets,
      leftHandicap: swapped.leftHandicap,
      rightHandicap: swapped.rightHandicap,
      leftServing: swapped.leftServing,
      rightServing: swapped.rightServing,
      phaseLabel: status === 'FINISHED' ? 'final' : 'quarterfinal',
      setWinner,
      matchWinner,
      isMatchOver,
    }
  }, [match])
}
