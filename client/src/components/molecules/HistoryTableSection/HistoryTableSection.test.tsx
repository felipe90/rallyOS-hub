import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryTableSection } from './HistoryTableSection'
import type { ScoreChange } from '@shared/types'

const mockHistory: ScoreChange[] = [
  {
    id: 'evt-1',
    player: 'A',
    action: 'POINT',
    pointsBefore: { a: 0, b: 0 },
    pointsAfter: { a: 1, b: 0 },
    timestamp: Date.now() - 60000,
  },
  {
    id: 'evt-2',
    player: 'B',
    action: 'CORRECTION',
    pointsBefore: { a: 1, b: 0 },
    pointsAfter: { a: 1, b: 1 },
    timestamp: Date.now() - 30000,
  },
]

const defaultProps = {
  tableId: 'table-1',
  tableName: 'Mesa 1',
  playerNames: { a: 'Juan', b: 'María' },
  history: mockHistory,
}

describe('HistoryTableSection', () => {
  it('renders header with table name and player names', () => {
    render(<HistoryTableSection {...defaultProps} />)
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Juan vs María')).toBeInTheDocument()
  })

  it('shows entry count badge', () => {
    render(<HistoryTableSection {...defaultProps} />)
    expect(screen.getByText('2 eventos')).toBeInTheDocument()
  })

  it('shows singular badge for single entry', () => {
    render(
      <HistoryTableSection
        {...defaultProps}
        history={[mockHistory[0]]}
      />
    )
    expect(screen.getByText('1 evento')).toBeInTheDocument()
  })

  it('collapsed by default (no history items shown)', () => {
    render(<HistoryTableSection {...defaultProps} />)
    // History items should NOT be visible when collapsed
    expect(screen.queryByText(/Punto/)).not.toBeInTheDocument()
  })

  it('expands on header click', () => {
    render(<HistoryTableSection {...defaultProps} />)
    const header = screen.getByText('Mesa 1').closest('button')!
    fireEvent.click(header)
    expect(screen.getByText(/Punto/)).toBeInTheDocument()
  })

  it('collapses on second header click', () => {
    render(<HistoryTableSection {...defaultProps} />)
    const header = screen.getByText('Mesa 1').closest('button')!

    fireEvent.click(header)
    expect(screen.getByText(/Punto/)).toBeInTheDocument()

    fireEvent.click(header)
    expect(screen.queryByText(/Punto/)).not.toBeInTheDocument()
  })

  it('starts expanded when defaultExpanded is true', () => {
    render(<HistoryTableSection {...defaultProps} defaultExpanded={true} />)
    expect(screen.getByText(/Punto/)).toBeInTheDocument()
    expect(screen.getByText(/Corrección/)).toBeInTheDocument()
  })

  it('resolves player A name via HistoryList', () => {
    render(<HistoryTableSection {...defaultProps} defaultExpanded={true} />)
    // Player A should resolve to 'Juan'
    expect(screen.getByText(/Punto - Juan/)).toBeInTheDocument()
  })

  it('resolves player B name via HistoryList', () => {
    render(<HistoryTableSection {...defaultProps} defaultExpanded={true} />)
    // Player B should resolve to 'María'
    expect(screen.getByText(/Corrección - María/)).toBeInTheDocument()
  })

  it('displays score transitions', () => {
    render(<HistoryTableSection {...defaultProps} defaultExpanded={true} />)
    expect(screen.getByText('0-0 → 1-0')).toBeInTheDocument()
    expect(screen.getByText('1-0 → 1-1')).toBeInTheDocument()
  })
})
