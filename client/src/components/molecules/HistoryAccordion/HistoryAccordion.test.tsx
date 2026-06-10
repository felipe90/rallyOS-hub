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
  it('renders one HistoryCourtSection per entry', () => {
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

    // First section should have expanded content visible (compact mode, spans separate)
    expect(screen.getByText('Punto')).toBeInTheDocument()

    // Second section should be collapsed (no history items visible from it)
    expect(screen.queryByText('Carlos')).not.toBeInTheDocument()
  })

  it('expand all opens all sections', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
      createEntry('table-2', 'Mesa 2', 'Carlos', 'Ana'),
    ]

    render(<HistoryAccordion entries={entries} />)

    fireEvent.click(screen.getByText('Expandir todos'))

    // Both tables have Punto in their history (compact mode, separate spans)
    const puntos = screen.getAllByText('Punto')
    expect(puntos.length).toBe(2)
  })

  it('collapse all closes all sections', () => {
    const entries: AllHistoryEntry[] = [
      createEntry('table-1', 'Mesa 1', 'Juan', 'María'),
      createEntry('table-2', 'Mesa 2', 'Carlos', 'Ana'),
    ]

    render(<HistoryAccordion entries={entries} />)

    // First click: expand all
    fireEvent.click(screen.getByText('Expandir todos'))
    // Both tables expanded → 2 Punto elements (one per table)
    const puntosAfterExpand = screen.getAllByText('Punto')
    expect(puntosAfterExpand.length).toBe(2)

    // Second click: collapse all
    fireEvent.click(screen.getByText('Colapsar todos'))

    // Both should now be collapsed - Punto should NOT be visible
    expect(screen.queryByText('Punto')).not.toBeInTheDocument()
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

  // ── Set Summary Display ────────────────────────────────

  it('displays set summary in header (e.g., "Juan 2-1 María")', () => {
    const entry: AllHistoryEntry = {
      tableId: 'table-1',
      tableName: 'Mesa 1',
      status: 'LIVE',
      playerNames: { a: 'Juan', b: 'María' },
      history: [
        {
          id: 'evt-1',
          player: 'A',
          action: 'SET_WON',
          pointsBefore: { a: 11, b: 5 },
          pointsAfter: { a: 11, b: 5 },
          setNumber: 1,
          timestamp: Date.now(),
        },
        {
          id: 'evt-2',
          player: 'A',
          action: 'SET_WON',
          pointsBefore: { a: 11, b: 9 },
          pointsAfter: { a: 11, b: 9 },
          setNumber: 2,
          timestamp: Date.now(),
        },
        {
          id: 'evt-3',
          player: 'B',
          action: 'SET_WON',
          pointsBefore: { a: 5, b: 11 },
          pointsAfter: { a: 5, b: 11 },
          setNumber: 3,
          timestamp: Date.now(),
        },
      ],
    }

    render(<HistoryAccordion entries={[entry]} />)

    // Juan won 2 sets, María won 1
    expect(screen.getByText('Juan 2-1 María')).toBeInTheDocument()
  })

  // ── Handicap Display ────────────────────────────────

  it('displays handicap when provided in AllHistoryEntry', () => {
    const entry: AllHistoryEntry = {
      tableId: 'table-1',
      tableName: 'Mesa 1',
      status: 'LIVE',
      playerNames: { a: 'Juan', b: 'María' },
      history: [],
      handicap: { a: 2, b: 0 },
    }

    render(<HistoryAccordion entries={[entry]} />)

    expect(screen.getByText(/Handicap:/)).toBeInTheDocument()
    expect(screen.getByText(/Juan \+2/)).toBeInTheDocument()
  })
})
