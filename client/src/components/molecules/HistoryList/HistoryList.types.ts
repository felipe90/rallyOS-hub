import type { ScoreChange } from '@shared/types'

export type { ScoreChange }

export interface HistoryListProps {
  history: ScoreChange[]
  compact?: boolean
  playerNames?: { a: string; b: string }
  onEdit?: (index: number) => void
  onDelete?: (index: number) => void
}
