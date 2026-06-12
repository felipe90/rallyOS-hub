import type { ScoreChange } from '@shared/types'

export interface HistoryCourtSectionProps {
  courtId: string
  courtName: string
  playerNames: { a: string; b: string }
  history: ScoreChange[]
  handicap?: {
    a?: number
    b?: number
  }
  defaultExpanded?: boolean
}
