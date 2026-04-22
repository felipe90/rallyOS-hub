import type { MatchStateExtended } from '@shared/types'

export interface MatchDisplayState {
  setsA: number
  setsB: number
  totalSets: number
  isSwapped: boolean
  leftPlayer: 'A' | 'B'
  rightPlayer: 'A' | 'B'
  leftName: string | undefined
  rightName: string | undefined
  leftScore: number
  rightScore: number
  leftSets: number
  rightSets: number
  leftHandicap: number | undefined
  rightHandicap: number | undefined
  leftServing: boolean
  rightServing: boolean
  phaseLabel: string
  setWinner: 'A' | 'B' | null
  matchWinner: 'A' | 'B' | null
  isMatchOver: boolean
}

export type UseMatchDisplayReturn = MatchDisplayState

export type UseMatchDisplayInput = MatchStateExtended
