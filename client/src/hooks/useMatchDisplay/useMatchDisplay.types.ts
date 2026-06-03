import type { MatchStateExtended, Sport, SportDisplayScore } from '@shared/types'

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
  /** The sport type of the current match */
  sport: Sport
  /** Sport-specific display score for the frontend */
  sportDisplayScore: SportDisplayScore
}

export type UseMatchDisplayReturn = MatchDisplayState

export type UseMatchDisplayInput = MatchStateExtended
