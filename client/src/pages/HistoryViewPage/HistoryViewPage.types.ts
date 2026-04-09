export interface HistoryEvent {
  id: string
  player: string
  action: 'POINT' | 'UNDO'
  timestamp: number
}

export interface CurrentMatch {
  history: HistoryEvent[]
}

export interface UseSocketContextValue {
  currentMatch: CurrentMatch | null
}
