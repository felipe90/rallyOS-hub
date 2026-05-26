/**
 * useMatchDisplay - Calculates match display values
 *
 * Thin wrapper over services/match/.
 */

import { useMemo } from 'react'
import type { MatchStateExtended } from '@shared/types'
import { isTableTennisStateExtended, SPORT } from '@shared/types'
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
    const { status, config } = match
    const m = match as any
    
    // Discriminate by sport to access score/setHistory
    const isPadel = match.sport === SPORT.PADEL
    const score = isPadel ? null : m.score
    const setHistory: Array<{ a: number; b: number }> = m.setHistory || []

    const { setsA, setsB } = calculateSetsWon(setHistory)
    const totalSets = config?.bestOf ? Math.ceil(config.bestOf / 2) * 2 - 1 : 3
    const pointsPerSet = isPadel ? 0 : (config as any)?.pointsPerSet || 11

    const swapped = applySideSwap(match, setsA, setsB)

    const cSet = score?.currentSet ?? { a: 0, b: 0 }
    const scoreA = swapped.leftPlayer === 'A' ? cSet.a : cSet.b
    const scoreB = swapped.leftPlayer === 'A' ? cSet.b : cSet.a

    const setWinner = pointsPerSet > 0 ? determineSetWinner(scoreA, scoreB, pointsPerSet) : null
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
