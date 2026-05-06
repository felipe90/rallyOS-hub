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
  it('renders header with table name and set summary', () => {
    render(<HistoryTableSection {...defaultProps} />)
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    // Should show set summary: "Juan {setsA}-{setsB} María"
    expect(screen.getByText('Juan 0-0 María')).toBeInTheDocument()
  })

  // ── Set Summary Calculation ─────────────────────────────

  it('shows set summary with sets won by each player', () => {
    const historyWithSets: ScoreChange[] = [
      {
        id: 'evt-1',
        player: 'A',
        action: 'POINT',
        pointsBefore: { a: 0, b: 0 },
        pointsAfter: { a: 1, b: 0 },
        timestamp: Date.now(),
      },
      {
        id: 'evt-2',
        player: 'A',
        action: 'SET_WON',
        pointsBefore: { a: 11, b: 9 },
        pointsAfter: { a: 11, b: 9 },
        setNumber: 1,
        timestamp: Date.now(),
      },
      {
        id: 'evt-3',
        player: 'B',
        action: 'SET_WON',
        pointsBefore: { a: 5, b: 11 },
        pointsAfter: { a: 5, b: 11 },
        setNumber: 2,
        timestamp: Date.now(),
      },
    ]

    render(
      <HistoryTableSection
        {...defaultProps}
        history={historyWithSets}
        defaultExpanded={true}
      />
    )
    // Player A won 1 set, Player B won 1 set
    expect(screen.getByText('Juan 1-1 María')).toBeInTheDocument()
  })

  it('shows 2-0 when player A won 2 sets', () => {
    const historyWithSets: ScoreChange[] = [
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
    ]

    render(
      <HistoryTableSection
        {...defaultProps}
        history={historyWithSets}
        defaultExpanded={true}
      />
    )
    expect(screen.getByText('Juan 2-0 María')).toBeInTheDocument()
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
    // Player A should resolve to 'Juan' (in compact mode, spans are separate)
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText('Punto')).toBeInTheDocument()
  })

  it('resolves player B name via HistoryList', () => {
    render(<HistoryTableSection {...defaultProps} defaultExpanded={true} />)
    // Player B should resolve to 'María'
    expect(screen.getByText('María')).toBeInTheDocument()
    expect(screen.getByText('Corrección')).toBeInTheDocument()
  })

  it('displays score transitions', () => {
    render(<HistoryTableSection {...defaultProps} defaultExpanded={true} />)
    expect(screen.getByText('0-0 → 1-0')).toBeInTheDocument()
    expect(screen.getByText('1-0 → 1-1')).toBeInTheDocument()
  })

  // ── Handicap Display ────────────────────────────────────────

  it('accepts handicap prop without crashing', () => {
    render(
      <HistoryTableSection
        {...defaultProps}
        handicap={{ a: 2, b: 0 }}
        defaultExpanded={true}
      />
    )
    // Component should render without crashing
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
  })

  it('displays handicap information when provided', () => {
    render(
      <HistoryTableSection
        {...defaultProps}
        handicap={{ a: 2, b: 0 }}
        defaultExpanded={true}
      />
    )
    // Should show handicap info in header
    expect(screen.getByText(/Handicap:/)).toBeInTheDocument()
    expect(screen.getByText(/Juan \+2/)).toBeInTheDocument()
    expect(screen.getByText(/María \+0/)).toBeInTheDocument()
  })

  it('does not display handicap when not provided', () => {
    render(
      <HistoryTableSection
        {...defaultProps}
        defaultExpanded={true}
      />
    )
    // Should NOT show handicap info
    expect(screen.queryByText(/Handicap:/)).not.toBeInTheDocument()
  })

  it('handles partial handicap (only one player)', () => {
    render(
      <HistoryTableSection
        {...defaultProps}
        handicap={{ a: 3 }}
        defaultExpanded={true}
      />
    )
    expect(screen.getByText(/Handicap:/)).toBeInTheDocument()
    expect(screen.getByText(/Juan \+3/)).toBeInTheDocument()
    // María should not show +0 since b is undefined
    expect(screen.queryByText(/\+0/)).not.toBeInTheDocument()
  })
})
