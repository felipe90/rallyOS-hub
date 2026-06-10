import type { ScoreChange } from '@shared/types'

export interface HistoryCourtSectionProps {
  tableId: string
  tableName: string
  playerNames: { a: string; b: string }
  history: ScoreChange[]
  handicap?: {
    a?: number
    b?: number
  }
  defaultExpanded?: boolean
}
