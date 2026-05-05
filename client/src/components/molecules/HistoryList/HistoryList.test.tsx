import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoryList } from './HistoryList'
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
    timestamp: Date.now() - 120000,
  },
  {
    id: 'evt-3',
    player: 'A',
    action: 'SET_WON',
    pointsBefore: { a: 11, b: 9 },
    pointsAfter: { a: 11, b: 9 },
    setNumber: 1,
    timestamp: Date.now() - 180000,
  },
]

const playerNames = { a: 'Juan', b: 'María' }

describe('HistoryList', () => {
  it('renders empty state when no items', () => {
    render(<HistoryList history={[]} />)
    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument()
  })

  it('renders empty state when history is undefined', () => {
    render(<HistoryList history={undefined as any} />)
    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument()
  })

  // ── Action Labels ──────────────────────────────────────────────

  it('displays POINT action label correctly', () => {
    render(
      <HistoryList history={[mockHistory[0]]} playerNames={playerNames} />
    )
    expect(screen.getByText(/⚽ Punto/)).toBeInTheDocument()
  })

  it('displays CORRECTION action label', () => {
    render(
      <HistoryList history={[mockHistory[1]]} playerNames={playerNames} />
    )
    expect(screen.getByText(/✏️ Corrección/)).toBeInTheDocument()
  })

  it('displays SET_WON action label', () => {
    render(
      <HistoryList history={[mockHistory[2]]} playerNames={playerNames} />
    )
    expect(screen.getByText(/🏆 Set ganado/)).toBeInTheDocument()
  })

  // ── Player Name Resolution ─────────────────────────────────────

  it('resolves player A to name via playerNames prop', () => {
    render(
      <HistoryList history={[mockHistory[0]]} playerNames={playerNames} />
    )
    expect(screen.getByText(/Juan/)).toBeInTheDocument()
  })

  it('resolves player B to name via playerNames prop', () => {
    render(
      <HistoryList history={[mockHistory[1]]} playerNames={playerNames} />
    )
    expect(screen.getByText(/María/)).toBeInTheDocument()
  })

  it('falls back to player A/B default when playerNames not provided', () => {
    render(<HistoryList history={[mockHistory[0]]} />)
    // Without playerNames, A maps to 'Player A'
    expect(screen.getByText(/Player A/)).toBeInTheDocument()
  })

  it('falls back to Player B default when player B and no playerNames', () => {
    render(<HistoryList history={[mockHistory[1]]} />)
    expect(screen.getByText(/Player B/)).toBeInTheDocument()
  })

  it('shows Desconocido when player is undefined', () => {
    const noPlayerEvent: ScoreChange = {
      id: 'evt-no-player',
      player: undefined,
      action: 'POINT',
      pointsBefore: { a: 0, b: 0 },
      pointsAfter: { a: 0, b: 0 },
      timestamp: Date.now(),
    }
    render(<HistoryList history={[noPlayerEvent]} />)
    expect(screen.getByText(/Desconocido/)).toBeInTheDocument()
  })

  // ── Score Display ──────────────────────────────────────────────

  it('displays score transitions in full mode', () => {
    render(<HistoryList history={[mockHistory[0]]} />)
    expect(screen.getByText('0-0 → 1-0')).toBeInTheDocument()
  })

  it('displays formatted timestamp', () => {
    const timestamp = new Date('2024-01-15T14:30:00').getTime()
    const event: ScoreChange = {
      id: 'evt-time',
      player: 'A',
      action: 'POINT',
      pointsBefore: { a: 0, b: 0 },
      pointsAfter: { a: 1, b: 0 },
      timestamp,
    }
    render(<HistoryList history={[event]} playerNames={playerNames} />)
    // 14:30 in local time format
    expect(screen.getByText(/2:30/)).toBeInTheDocument()
  })

  // ── Compact Mode ───────────────────────────────────────────────

  it('renders history items in compact mode', () => {
    render(
      <HistoryList
        history={mockHistory}
        compact={true}
        playerNames={playerNames}
      />
    )
    // Check that action labels are present (in compact form)
    expect(screen.getByText(/⚽ Punto - Juan/)).toBeInTheDocument()
    expect(screen.getByText(/✏️ Corrección - María/)).toBeInTheDocument()
  })
})
