/**
 * useMatchDisplay - Calculates match display values
 *
 * Thin orchestrator: delegates sport-specific logic to SportDisplayAdapter
 * via useSportAdapter hook. All `if (isPadel)` branches eliminated.
 */

import { useMemo } from 'react'
import type { MatchStateExtended, Sport, SportDisplayScore } from '@shared/types'
import { SPORT } from '@shared/types'
import {
  calculateSetsWon,
  determineSetWinner,
  determineMatchWinner,
  applySideSwap,
} from '@/services/match'
import { useSportAdapter } from '../useSportAdapter/useSportAdapter'

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
  sport: Sport
  sportDisplayScore: SportDisplayScore
}

export function useMatchDisplay(match: MatchStateExtended): MatchDisplayState {
  const adapter = useSportAdapter(match)

  return useMemo(() => {
    const { status, config } = match

    // Discriminate to access setHistory safely
    const setHistory: Array<{ a: number; b: number }> = (match as any).setHistory || []

    const { setsA, setsB } = calculateSetsWon(setHistory)
    const totalSets = config?.bestOf ? Math.ceil(config.bestOf / 2) * 2 - 1 : 3

    // Delegate side swap to adapter
    const swapped = applySideSwap(match, setsA, setsB, adapter)

    // Compute set winner (TT-specific logic — only relevant when scoring unit is points)
    let setWinner: 'A' | 'B' | null = null
    if (adapter.sport === SPORT.TABLE_TENNIS) {
      const scores = adapter.getCurrentScores(match)
      const scoreA = swapped.leftPlayer === 'A' ? scores.a : scores.b
      const scoreB = swapped.leftPlayer === 'A' ? scores.b : scores.a
      const ttc = adapter.getConfigDefaults()
      const pointsPerSet = (ttc as any).pointsPerSet ?? 11
      setWinner = determineSetWinner(scoreA, scoreB, pointsPerSet)
    }

    const matchWinner = determineMatchWinner(setsA, setsB, totalSets)
    const isMatchOver = status === 'FINISHED' || !!matchWinner

    // Compute SportDisplayScore via adapter
    const sport: Sport = (match as any).sport ?? SPORT.TABLE_TENNIS
    const sportDisplayScore: SportDisplayScore = adapter.computeDisplayData(match)

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
      sport,
      sportDisplayScore,
    }
  }, [match, adapter])
}
