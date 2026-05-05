import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Typography } from '../../atoms/Typography'
import { HistoryTableSection } from '../HistoryTableSection/HistoryTableSection'
import type { HistoryAccordionProps } from './HistoryAccordion.types'

export function HistoryAccordion({ entries }: HistoryAccordionProps) {
  const [allExpanded, setAllExpanded] = useState(false)

  const toggleAll = () => {
    setAllExpanded(!allExpanded)
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
          defaultExpanded={allExpanded || idx === 0}
        />
      ))}
    </div>
  )
}
