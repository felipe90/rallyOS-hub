import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithI18n } from '@/test/test-utils'
import { BracketMatchCard } from './BracketMatchCard'
import type { BracketMatch } from '@shared/types'

function makeMatch(overrides: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id: 'R1-M1',
    round: 1,
    position: 0,
    playerA: null,
    playerB: null,
    winner: null,
    status: 'PENDING',
    courtId: null,
    ...overrides,
  }
}

const noop = () => {}

describe('BracketMatchCard — pending (both slots empty)', () => {
  it('shows two assign placeholder buttons and no winner buttons', () => {
    renderWithI18n(
      <BracketMatchCard
        match={makeMatch()}
        onAssignSlot={noop}
        onSetWinner={noop}
        onAssignCourt={noop}
        onUndo={noop}
      />,
    )
    const placeholders = screen.getAllByRole('button', { name: /Tocá para asignar/i })
    expect(placeholders).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Ganó A/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ganó B/i })).not.toBeInTheDocument()
  })

  it('clicking slot A calls onAssignSlot with matchId + A', () => {
    const onAssignSlot = vi.fn()
    renderWithI18n(
      <BracketMatchCard
        match={makeMatch()}
        onAssignSlot={onAssignSlot}
        onSetWinner={noop}
        onAssignCourt={noop}
        onUndo={noop}
      />,
    )
    const placeholders = screen.getAllByRole('button', { name: /Tocá para asignar/i })
    fireEvent.click(placeholders[0])
    expect(onAssignSlot).toHaveBeenCalledWith('R1-M1', 'A')
    expect(onAssignSlot).toHaveBeenCalledTimes(1)
  })

  it('court button shows "Sin mesa" and clicking calls onAssignCourt', () => {
    const onAssignCourt = vi.fn()
    renderWithI18n(
      <BracketMatchCard
        match={makeMatch()}
        onAssignSlot={noop}
        onSetWinner={noop}
        onAssignCourt={onAssignCourt}
        onUndo={noop}
      />,
    )
    const court = screen.getByRole('button', { name: /Sin mesa/i })
    fireEvent.click(court)
    expect(onAssignCourt).toHaveBeenCalledWith('R1-M1')
  })
})

describe('BracketMatchCard — ready (both slots filled)', () => {
  const ready = makeMatch({
    playerA: 'Alice',
    playerB: 'Bob',
    status: 'READY',
  })

  it('renders both player names', () => {
    renderWithI18n(
      <BracketMatchCard match={ready} onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders winner buttons with player names', () => {
    renderWithI18n(
      <BracketMatchCard match={ready} onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    expect(screen.getByRole('button', { name: /Ganó Alice/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ganó Bob/i })).toBeInTheDocument()
  })

  it('clicking Ganó Alice opens confirm dialog; confirming calls onSetWinner', () => {
    const onSetWinner = vi.fn()
    renderWithI18n(
      <BracketMatchCard match={ready} onAssignSlot={noop} onSetWinner={onSetWinner} onAssignCourt={noop} onUndo={noop} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ganó Alice/i }))
    // ConfirmDialog open — message interpolates the player name
    expect(screen.getByText(/¿Marcar a Alice como ganador\?/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }))
    expect(onSetWinner).toHaveBeenCalledWith('R1-M1', 'A')
  })

  it('clicking Ganó Bob then cancelling does nothing', () => {
    const onSetWinner = vi.fn()
    renderWithI18n(
      <BracketMatchCard match={ready} onAssignSlot={noop} onSetWinner={onSetWinner} onAssignCourt={noop} onUndo={noop} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ganó Bob/i }))
    expect(screen.getByText(/¿Marcar a Bob como ganador\?/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }))
    expect(onSetWinner).not.toHaveBeenCalled()
  })
})

describe('BracketMatchCard — bye (one slot occupied, other empty)', () => {
  const bye = makeMatch({
    playerA: 'Alice',
    playerB: null,
    status: 'READY',
  })

  it('shows Avanza directo badge on the occupied player', () => {
    renderWithI18n(
      <BracketMatchCard match={bye} onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    expect(screen.getByText(/Avanza directo/i)).toBeInTheDocument()
  })

  it('empty slot is clickable — bye is informational, not a blocker', () => {
    const onAssignSlot = vi.fn()
    renderWithI18n(
      <BracketMatchCard match={bye} onAssignSlot={onAssignSlot} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    // Empty "Tocá para asignar" slot is NOT disabled — bye is informational
    const slotB = screen.getByRole('button', { name: /Tocá para asignar/i })
    expect(slotB.hasAttribute('disabled')).toBe(false)
    // Clicking the empty slot assigns as usual
    fireEvent.click(slotB)
    expect(onAssignSlot).toHaveBeenCalledWith('R1-M1', 'B')
  })

  it('clicking Ganó Alice advances the bye and (via confirm) calls onSetWinner', () => {
    const onSetWinner = vi.fn()
    renderWithI18n(
      <BracketMatchCard match={bye} onAssignSlot={noop} onSetWinner={onSetWinner} onAssignCourt={noop} onUndo={noop} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ganó Alice/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }))
    expect(onSetWinner).toHaveBeenCalledWith('R1-M1', 'A')
  })
})

describe('BracketMatchCard — completed', () => {
  const completed = makeMatch({
    playerA: 'Alice',
    playerB: 'Bob',
    winner: 'A',
    status: 'COMPLETED',
  })

  it('shows Completado badge and an undo button; no winner buttons', () => {
    renderWithI18n(
      <BracketMatchCard match={completed} onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    expect(screen.getByText(/Completado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Deshacer/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ganó A/i })).not.toBeInTheDocument()
  })

  it('clicking Deshacer opens confirm; confirming calls onUndo', () => {
    const onUndo = vi.fn()
    renderWithI18n(
      <BracketMatchCard match={completed} onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={onUndo} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }))
    expect(onUndo).toHaveBeenCalledWith('R1-M1')
  })
})

describe('BracketMatchCard — court states', () => {
  it('renders the live court label when assigned and present', () => {
    const match = makeMatch({ playerA: 'Alice', playerB: 'Bob', status: 'READY', courtId: 'court-1' })
    renderWithI18n(
      <BracketMatchCard match={match} courtLabel="Cancha 3" onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    expect(screen.getByText('Cancha 3')).toBeInTheDocument()
  })

  it('renders "Mesa eliminada" when court is orphan (courtId set but removed)', () => {
    const match = makeMatch({ status: 'READY', playerA: 'A', playerB: 'B', courtId: 'court-gone' })
    renderWithI18n(
      <BracketMatchCard match={match} courtOrphan onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    expect(screen.getByText(/Mesa eliminada/i)).toBeInTheDocument()
  })

  it('shows a non-blocking warning when the court is occupied by another match', () => {
    const match = makeMatch({ status: 'READY', playerA: 'A', playerB: 'B', courtId: 'c' })
    renderWithI18n(
      <BracketMatchCard match={match} courtLabel="Cancha 1" courtOccupied onAssignSlot={noop} onSetWinner={noop} onAssignCourt={noop} onUndo={noop} />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/ocupada por otro partido/i)
  })
})