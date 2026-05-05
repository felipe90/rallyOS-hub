import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Typography } from '../../atoms/Typography'
import { HistoryList } from '../HistoryList/HistoryList'
import type { HistoryTableSectionProps } from './HistoryTableSection.types'

export function HistoryTableSection({
  tableId,
  tableName,
  playerNames,
  history,
  defaultExpanded = false,
}: HistoryTableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Sync with defaultExpanded prop changes (for expand all / collapse all)
  useEffect(() => {
    setIsExpanded(defaultExpanded)
  }, [defaultExpanded])

  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls={`history-section-${tableId}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
          )}
          <div className="min-w-0">
            <Typography variant="body" className="font-semibold truncate">
              {tableName}
            </Typography>
            <Typography variant="caption" className="text-text-muted">
              {playerNames.a} vs {playerNames.b}
            </Typography>
          </div>
        </div>
        <span className="text-xs text-text-muted bg-surface-high px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
          {history.length} {history.length === 1 ? 'evento' : 'eventos'}
        </span>
      </button>

      {isExpanded && (
        <div
          id={`history-section-${tableId}`}
          className="px-4 pb-4 border-t border-border"
        >
          <HistoryList
            history={history}
            playerNames={playerNames}
          />
        </div>
      )}
    </div>
  )
}
