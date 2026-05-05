import type { ScoreChange } from '@shared/types'

export interface HistoryTableSectionProps {
  tableId: string
  tableName: string
  playerNames: { a: string; b: string }
  history: ScoreChange[]
  defaultExpanded?: boolean
}
