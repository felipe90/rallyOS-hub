import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryAccordion } from './HistoryAccordion'
import type { AllHistoryEntry } from '@shared/types'

const createEntry = (id: string, name: string, playerA: string, playerB: string): AllHistoryEntry => ({
  tableId: id,
  tableName: name,
  status: 'LIVE',
  playerNames: { a: playerA, b: playerB },
  history: [
    {
      id: `${id}-evt-1`,
      player: 'A',
      action: 'POINT',
      pointsBefore: { a: 0, b: 0 },
      pointsAfter: { a: 1, b: 0 },
      timestamp: Date.now() - 60000,
    },
  ],
})

describe('HistoryAccordion', () => {
  it('renders one HistoryTableSection per entry', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
      createEntry('table-2', 'Mesa 2', 'Carlos', 'Ana'),
    ]

    render(<HistoryAccordion entries={entries} />)

    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Mesa 2')).toBeInTheDocument()
  })

  it('first entry expanded by default', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
      createEntry('table-2', 'Mesa 2', 'Carlos', 'Ana'),
    ]

    render(<HistoryAccordion entries={entries} />)

    // First section should have expanded content visible
    expect(screen.getByText('⚽ Punto - Juan')).toBeInTheDocument()

    // Second section should be collapsed (no history items visible from it)
    const mesa2Event = screen.queryByText('⚽ Punto - Carlos')
    expect(mesa2Event).not.toBeInTheDocument()
  })

  it('expand all opens all sections', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
      createEntry('table-2', 'Mesa 2', 'Carlos', 'Ana'),
    ]

    render(<HistoryAccordion entries={entries} />)

    fireEvent.click(screen.getByText('Expandir todos'))

    // Both player entries should now be visible
    expect(screen.getByText('⚽ Punto - Juan')).toBeInTheDocument()
    expect(screen.getByText('⚽ Punto - Carlos')).toBeInTheDocument()
  })

  it('collapse all closes all sections', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
      createEntry('table-2', 'Mesa 2', 'Carlos', 'Ana'),
    ]

    render(<HistoryAccordion entries={entries} />)

    // First click: expand all
    fireEvent.click(screen.getByText('Expandir todos'))
    expect(screen.getByText('⚽ Punto - Juan')).toBeInTheDocument()
    expect(screen.getByText('⚽ Punto - Carlos')).toBeInTheDocument()

    // Second click: collapse all
    fireEvent.click(screen.getByText('Colapsar todos'))

    // Both should now be collapsed
    expect(screen.queryByText('⚽ Punto - Juan')).not.toBeInTheDocument()
    expect(screen.queryByText('⚽ Punto - Carlos')).not.toBeInTheDocument()
  })

  it('does not show expand/collapse all for single entry', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
    ]

    render(<HistoryAccordion entries={entries} />)

    expect(screen.queryByText('Expandir todos')).not.toBeInTheDocument()
    expect(screen.queryByText('Colapsar todos')).not.toBeInTheDocument()
  })

  it('renders nothing broken when entries is empty', () => {
    render(<HistoryAccordion entries={[]} />)

    // No sections should exist
    expect(screen.queryByText('evento')).not.toBeInTheDocument()
    expect(screen.queryByText('eventos')).not.toBeInTheDocument()
  })
})
