import { Typography } from '../../atoms/Typography'
import type { ScoreChange } from '@shared/types'

export interface HistoryListProps {
  history: ScoreChange[]
  compact?: boolean
  playerNames?: { a: string; b: string }
  onEdit?: (index: number) => void
  onDelete?: (index: number) => void
}

/**
 * Reusable component for displaying score history
 * Can be used in both HistoryDrawer and HistoryViewPage
 * Supports compact mode for sidebars and full mode for pages
 */
export function HistoryList({
  history,
  compact = false,
  playerNames,
  onEdit,
  onDelete
}: HistoryListProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center text-text-muted py-8">
        <Typography variant="body">Sin eventos registrados</Typography>
      </div>
    )
  }

  const resolvePlayer = (player?: 'A' | 'B'): string => {
    if (player === 'A') return playerNames?.a ?? 'Player A'
    if (player === 'B') return playerNames?.b ?? 'Player B'
    return 'Desconocido'
  }

  const formatActionLabel = (action: 'POINT' | 'CORRECTION' | 'SET_WON'): string => {
    switch (action) {
      case 'POINT': return '⚽ Punto'
      case 'CORRECTION': return '✏️ Corrección'
      case 'SET_WON': return '🏆 Set ganado'
      default: return action
    }
  }

  return (
    <div className={`space-y-${compact ? '1' : '2'}`}>
      {history.map((event, idx) => {
        const timestamp = new Date(event.timestamp).toLocaleTimeString()
        const actionLabel = formatActionLabel(event.action)
        const playerName = resolvePlayer(event.player)

        if (compact) {
          return (
            <div
              key={event.id ?? idx}
              className="flex items-center justify-between px-2 py-1 text-xs bg-surface-high rounded border border-border/50"
            >
              <span className="flex-1">
                {actionLabel} - {playerName}
              </span>
              <span className="text-text-muted text-[10px]">{timestamp}</span>
            </div>
          )
        }

        const hasScores = event.pointsBefore && event.pointsAfter

        return (
          <div
            key={event.id ?? idx}
            className="p-3 bg-surface-secondary rounded-lg border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <Typography variant="body" className="font-semibold">
                {actionLabel} - {playerName}
              </Typography>
              <Typography variant="caption" className="text-text-muted">
                {timestamp}
              </Typography>
            </div>
            {hasScores && (
              <Typography variant="caption" className="text-text-muted">
                {event.pointsBefore!.a}-{event.pointsBefore!.b} → {event.pointsAfter!.a}-{event.pointsAfter!.b}
              </Typography>
            )}
            {(onEdit || onDelete) && (
              <div className="flex gap-2 mt-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(idx)}
                    className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition"
                  >
                    Editar
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(idx)}
                    className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 transition"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
