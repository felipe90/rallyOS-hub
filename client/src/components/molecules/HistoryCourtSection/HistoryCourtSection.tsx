import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Typography } from '../../atoms/Typography'
import { HistoryList } from '../HistoryList/HistoryList'
import type { HistoryCourtSectionProps } from './HistoryCourtSection.types'
import type { ScoreChange } from '@shared/types'

export function HistoryCourtSection({
  tableId,
  tableName,
  playerNames,
  history,
  handicap,
  defaultExpanded = false,
}: HistoryCourtSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Sync with defaultExpanded prop changes (for expand all / collapse all)
  useEffect(() => {
    setIsExpanded(defaultExpanded)
  }, [defaultExpanded])

  // Compute set summary from history (count SET_WON actions per player)
  const setSummary = useMemo(() => {
    const setsWon = { a: 0, b: 0 }
    history.forEach((event: ScoreChange) => {
      if (event.action === 'SET_WON') {
        if (event.player === 'A') setsWon.a++
        if (event.player === 'B') setsWon.b++
      }
    })
    return setsWon
  }, [history])

  // Format handicap display
  const handicapDisplay = useMemo(() => {
    if (!handicap) return null
    const parts = []
    if (handicap.a !== undefined) parts.push(`${playerNames.a} +${handicap.a}`)
    if (handicap.b !== undefined) parts.push(`${playerNames.b} +${handicap.b}`)
    return parts.length > 0 ? `Handicap: ${parts.join(', ')}` : null
  }, [handicap, playerNames])

  return (
    <div className="card border border-border rounded-lg bg-surface overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls={`history-section-${tableId}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <div className="min-w-0">
            <Typography variant="body" className="font-semibold truncate text-sm">
              {tableName}
            </Typography>
            <Typography variant="caption" className="text-text-muted text-xs">
              {playerNames.a} {setSummary.a}-{setSummary.b} {playerNames.b}
              {handicapDisplay && (
                <>
                  {' · '}
                  <span className="text-xs text-text-muted">{handicapDisplay}</span>
                </>
              )}
            </Typography>
          </div>
        </div>
        <span className="text-xs text-text-muted bg-surface-high px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
          {history.length} {history.length === 1 ? 'evento' : 'eventos'}
        </span>
      </button>

      <div
        id={`history-section-${tableId}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isExpanded}
      >
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-border">
            <HistoryList
              history={history}
              playerNames={playerNames}
              compact={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}
