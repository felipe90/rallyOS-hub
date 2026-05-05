import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Typography } from '../../atoms/Typography'
import { HistoryTableSection } from '../HistoryTableSection/HistoryTableSection'
import type { HistoryAccordionProps } from './HistoryAccordion.types'

export function HistoryAccordion({ entries }: HistoryAccordionProps) {
  // null = initial (first expanded, rest collapsed)
  // true = all expanded (Expandir todos clicked)
  // false = all collapsed (Colapsar todos clicked)
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null)

  const toggleAll = () => {
    setAllExpanded(prev => prev !== true)
  }

  return (
    <div className="space-y-2">
      {entries.length > 1 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors px-3 py-1"
          >
            {allExpanded ? (
              <>
                <ChevronDown className="w-4 h-4" />
                Colapsar todos
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                Expandir todos
              </>
            )}
          </button>
        </div>
      )}

      {entries.map((entry, idx) => (
        <HistoryTableSection
          key={entry.tableId}
          tableId={entry.tableId}
          tableName={entry.tableName}
          playerNames={entry.playerNames}
          history={entry.history}
          handicap={entry.handicap}
          defaultExpanded={allExpanded === null ? idx === 0 : allExpanded}
        />
      ))}
    </div>
  )
}
