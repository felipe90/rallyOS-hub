import { Typography } from '../../atoms/Typography'

export interface ScoreChange {
  action: 'POINT' | 'UNDO'
  player: string | undefined
  timestamp: number
}

export interface HistoryListProps {
  history: ScoreChange[]
  compact?: boolean
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

  return (
    <div className={`space-y-${compact ? '1' : '2'}`}>
      {history.map((event, idx) => {
        const timestamp = new Date(event.timestamp).toLocaleTimeString()
        const actionLabel = event.action === 'POINT' ? '⚽ Punto' : '↩️ Deshacer'
        const playerName = event.player || 'Desconocido'

        if (compact) {
          return (
            <div
              key={idx}
              className="flex items-center justify-between px-2 py-1 text-xs bg-surface-high rounded border border-border/50"
            >
              <span className="flex-1">
                {actionLabel} - {playerName}
              </span>
              <span className="text-text-muted text-[10px]">{timestamp}</span>
            </div>
          )
        }

        return (
          <div
            key={idx}
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
