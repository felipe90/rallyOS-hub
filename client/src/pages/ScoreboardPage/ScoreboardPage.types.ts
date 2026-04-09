import type { MatchStateExtended, TableStatus, Player, Score, MatchConfig, ScoreChange } from '@/shared/types'

export interface ScoreboardPageProps {
  tableId?: string
}

export interface ScoreboardHandlers {
  onScorePoint: (player: 'A' | 'B') => void
  onSubtractPoint: (player: 'A' | 'B') => void
  onUndo: () => void
  onSetServer: (player: 'A' | 'B') => void
  onStartMatch: (config: MatchConfig) => void
  onCancelMatch: () => void
}

export type { MatchStateExtended, TableStatus, Player, Score, MatchConfig, ScoreChange }
