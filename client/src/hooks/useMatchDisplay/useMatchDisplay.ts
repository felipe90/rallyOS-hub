import { useMemo } from 'react'
import type { MatchStateExtended } from '../../shared/types'
import type { MatchDisplayState } from './useMatchDisplay.types'

export { type MatchDisplayState } from './useMatchDisplay.types'

/**
 * Hook to extract and calculate match display logic
 * Separates business logic from UI rendering
 * Returns all computed values for match state display
 */
export function useMatchDisplay(match: MatchStateExtended): MatchDisplayState {
  const displayState = useMemo(() => {
    const { score, status, playerNames, setHistory, config, swappedSides } = match

    // Calculate sets won for each player
    const setsA = setHistory.filter(s => s.a > s.b).length
    const setsB = setHistory.filter(s => s.b > s.a).length
    const totalSets = config?.bestOf ? Math.ceil(config.bestOf / 2) * 2 - 1 : 3

    // Apply side swap (ITTF Rule - swap sides between sets)
    const isSwapped = swappedSides === true

    // Swap player data if sides are swapped
    const leftPlayer: 'A' | 'B' = isSwapped ? 'B' : 'A'
    const rightPlayer: 'A' | 'B' = isSwapped ? 'A' : 'B'

    const leftName = isSwapped ? playerNames?.b : playerNames?.a
    const rightName = isSwapped ? playerNames?.a : playerNames?.b

    const leftScore = isSwapped ? score.currentSet.b : score.currentSet.a
    const rightScore = isSwapped ? score.currentSet.a : score.currentSet.b

    const leftSets = isSwapped ? setsB : setsA
    const rightSets = isSwapped ? setsA : setsB

    const leftHandicap = isSwapped ? config?.handicapB : config?.handicapA
    const rightHandicap = isSwapped ? config?.handicapA : config?.handicapB

    // Serving: if swapped, A becomes B visually
    const leftServing = isSwapped ? score.serving === 'B' : score.serving === 'A'
    const rightServing = isSwapped ? score.serving === 'A' : score.serving === 'B'

    // Determine phase label
    const phaseLabel = status === 'FINISHED' ? 'final' : 'quarterfinal'

    // Detect set winner (first to pointsPerSet)
    const pointsPerSet = config?.pointsPerSet || 11

    // Set winner logic (based on actual players A and B, not swapped display)
    const scoreA = isSwapped ? score.currentSet.b : score.currentSet.a
    const scoreB = isSwapped ? score.currentSet.a : score.currentSet.b

    const setWinner: 'A' | 'B' | null =
      scoreA >= pointsPerSet && scoreA > scoreB
        ? 'A'
        : scoreB >= pointsPerSet && scoreB > scoreA
        ? 'B'
        : null

    // Match winner logic (best of X means first to win (bestOf+1)/2 sets)
    const setsNeeded = Math.ceil((totalSets + 1) / 2)
    const matchWinner: 'A' | 'B' | null =
      setsA >= setsNeeded
        ? 'A'
        : setsB >= setsNeeded
        ? 'B'
        : null

    const isMatchOver = status === 'FINISHED' || !!matchWinner

    return {
      setsA,
      setsB,
      totalSets,
      isSwapped,
      leftPlayer,
      rightPlayer,
      leftName,
      rightName,
      leftScore,
      rightScore,
      leftSets,
      rightSets,
      leftHandicap,
      rightHandicap,
      leftServing,
      rightServing,
      phaseLabel,
      setWinner,
      matchWinner,
      isMatchOver
    }
  }, [match])

  return displayState
}
