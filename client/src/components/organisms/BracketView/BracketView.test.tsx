import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithI18n } from '@/test/test-utils'
import { BracketView } from './BracketView'
import type { TournamentBracket, BracketMatch, CourtInfo } from '@shared/types'

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

function makeBracket(overrides: Partial<TournamentBracket> = {}): TournamentBracket {
  return {
    name: 'Cuatro',
    numSlots: 4,
    includeThirdPlace: false,
    matches: [
      makeMatch({ id: 'R1-M1', position: 0 }),
      makeMatch({ id: 'R1-M2', position: 1 }),
      makeMatch({ id: 'R2-M1', round: 2, position: 0, status: 'PENDING' }),
    ],
    thirdPlaceMatch: null,
    status: 'SETUP',
    createdAt: Date.now(),
    ...overrides,
  }
}

function makeCourt(id: string, name: string): CourtInfo {
  return {
    id,
    number: 1,
    name,
    status: 'LIVE',
    playerCount: 2,
    /* mode omitted to mimic any tournament court */
  } as CourtInfo
}

const noop = () => {}

const handlers = {
  onCreate: noop,
  onAssignPlayer: noop,
  onSetWinner: noop,
  onAssignCourt: noop,
  onUndo: noop,
  onReset: noop as ((token?: string) => void),
  onResetConfirm: noop,
  onClearError: noop,
}

describe('BracketView — empty state (no bracket)', () => {
  it('renders the setup form when bracket is null', () => {
    renderWithI18n(
      <BracketView
        bracket={null}
        courts={[]}
        resetToken={null}
        {...handlers}
      />,
    )
    expect(screen.getByText(/Crear bracket/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Crear$/i })).toBeInTheDocument()
  })

  it('lets the owner pick a size and create', () => {
    const onCreate = vi.fn()
    renderWithI18n(
      <BracketView bracket={null} courts={[]} resetToken={null} {...handlers} onCreate={onCreate} />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Torneo Central' } })
    const size8 = screen.getByRole('button', { name: /8 jugadores/i })
    fireEvent.click(size8)
    fireEvent.click(screen.getByRole('button', { name: /^Crear$/i }))
    expect(onCreate).toHaveBeenCalledWith('Torneo Central', 8, false)
  })

  it('toggles 3rd place and reports it on create', () => {
    const onCreate = vi.fn()
    renderWithI18n(
      <BracketView bracket={null} courts={[]} resetToken={null} {...handlers} onCreate={onCreate} />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /16 jugadores/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /3er puesto/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Crear$/i }))
    expect(onCreate).toHaveBeenCalledWith('X', 16, true)
  })

  it('disables Create when the name is empty', () => {
    const onCreate = vi.fn()
    renderWithI18n(
      <BracketView bracket={null} courts={[]} resetToken={null} {...handlers} onCreate={onCreate} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /4 jugadores/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Crear$/i }))
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('BracketView — rounds rendering', () => {
  it('groups matches into named rounds (Semis + Final for a 4-slot bracket)', () => {
    renderWithI18n(
      <BracketView bracket={makeBracket()} courts={[]} resetToken={null} {...handlers} />,
    )
    expect(screen.getByText(/^Semis$/)).toBeInTheDocument()
    expect(screen.getByText(/^Final$/)).toBeInTheDocument()
    // Two Semis matches + one Final match
    expect(screen.getAllByText(/Tocá para asignar/i).length).toBeGreaterThanOrEqual(2)
  })

  it('renders a 3rd place section when the bracket includes it', () => {
    const b = makeBracket({
      numSlots: 4,
      includeThirdPlace: true,
      matches: [
        makeMatch({ id: 'R1-M1', position: 0 }),
        makeMatch({ id: 'R1-M2', position: 1 }),
        makeMatch({ id: 'R2-M1', round: 2, position: 0 }),
      ],
      thirdPlaceMatch: makeMatch({ id: 'TP-M1', round: 3, position: 0, status: 'PENDING' }),
    })
    renderWithI18n(<BracketView bracket={b} courts={[]} resetToken={null} {...handlers} />)
    expect(screen.getByText(/3er Puesto/i)).toBeInTheDocument()
  })

  it('maps 8-slot round 1 to Cuartos', () => {
    const b = makeBracket({
      numSlots: 8,
      matches: [makeMatch({ id: 'R1-M1' })],
    })
    renderWithI18n(<BracketView bracket={b} courts={[]} resetToken={null} {...handlers} />)
    expect(screen.getByText(/^Cuartos$/)).toBeInTheDocument()
  })

  it('maps 16-slot round 1 to R16', () => {
    const b = makeBracket({
      numSlots: 16,
      matches: [makeMatch({ id: 'R1-M1' })],
    })
    renderWithI18n(<BracketView bracket={b} courts={[]} resetToken={null} {...handlers} />)
    expect(screen.getByText(/^R16$/)).toBeInTheDocument()
  })
})

describe('BracketView — slot assignment modal', () => {
  it('clicking a slot opens the assign modal; saving assigns the player', () => {
    const onAssignPlayer = vi.fn()
    renderWithI18n(
      <BracketView
        bracket={makeBracket()}
        courts={[]}
        resetToken={null}
        {...handlers}
        onAssignPlayer={onAssignPlayer}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Tocá para asignar/i })[0])
    expect(screen.getByText(/Asignar jugador/i)).toBeInTheDocument()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Zoe' } })
    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }))
    expect(onAssignPlayer).toHaveBeenCalledWith('R1-M1', 'A', 'Zoe')
  })

  it('saving with an empty name clears the slot', () => {
    const onAssignPlayer = vi.fn()
    renderWithI18n(
      <BracketView
        bracket={makeBracket({
          matches: [makeMatch({ id: 'R1-M1', playerA: 'Zoe', playerB: null, status: 'READY' })],
        })}
        courts={[]}
        resetToken={null}
        {...handlers}
        onAssignPlayer={onAssignPlayer}
      />,
    )
    // "Zoe" is a slot button (BRACKET status READY): clicking it opens assign modal
    fireEvent.click(screen.getByText('Zoe'))
    // Clear the prefilled name, then save → empty name clears the slot.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }))
    expect(onAssignPlayer).toHaveBeenCalledWith('R1-M1', 'A', '')
  })
})

describe('BracketView — court assignment modal', () => {
  it('clicking the court button lists available courts; selecting one assigns', () => {
    const onAssignCourt = vi.fn()
    renderWithI18n(
      <BracketView
        bracket={makeBracket()}
        courts={[makeCourt('c-1', 'Cancha 1'), makeCourt('c-2', 'Cancha 2')]}
        resetToken={null}
        {...handlers}
        onAssignCourt={onAssignCourt}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Sin mesa/i })[0])
    expect(screen.getByText(/Asignar mesa/i)).toBeInTheDocument()
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Cancha 2')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancha 2'))
    expect(onAssignCourt).toHaveBeenCalledWith('R1-M1', 'c-2')
  })

  it('"Sin mesa" clears the court', () => {
    const onAssignCourt = vi.fn()
    const b = makeBracket({
      matches: [makeMatch({ id: 'R1-M1', status: 'READY', playerA: 'A', playerB: 'B', courtId: 'c-1' })],
    })
    renderWithI18n(
      <BracketView
        bracket={b}
        courts={[makeCourt('c-1', 'Cancha 1')]}
        resetToken={null}
        {...handlers}
        onAssignCourt={onAssignCourt}
      />,
    )
    fireEvent.click(screen.getByText('Cancha 1'))
    fireEvent.click(screen.getByRole('button', { name: /^Sin mesa$/i }))
    expect(onAssignCourt).toHaveBeenCalledWith('R1-M1', null)
  })

  it('shows "Mesa eliminada" when the assigned court is missing from the list', () => {
    const b = makeBracket({
      matches: [makeMatch({ id: 'R1-M1', status: 'READY', playerA: 'A', playerB: 'B', courtId: 'ghost' })],
    })
    renderWithI18n(<BracketView bracket={b} courts={[]} resetToken={null} {...handlers} />)
    expect(screen.getByText(/Mesa eliminada/i)).toBeInTheDocument()
  })
})

describe('BracketView — winner confirm + undo', () => {
  it('delegates winner confirm to BracketMatchCard and calls onSetWinner', () => {
    const onSetWinner = vi.fn()
    const b = makeBracket({
      matches: [makeMatch({ id: 'R1-M1', status: 'READY', playerA: 'Alice', playerB: 'Bob' })],
    })
    renderWithI18n(
      <BracketView bracket={b} courts={[]} resetToken={null} {...handlers} onSetWinner={onSetWinner} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ganó Alice/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }))
    expect(onSetWinner).toHaveBeenCalledWith('R1-M1', 'A')
  })

  it('delegates undo to BracketMatchCard and calls onUndo', () => {
    const onUndo = vi.fn()
    const b = makeBracket({
      matches: [makeMatch({ id: 'R2-M1', round: 2, status: 'COMPLETED', playerA: 'Alice', playerB: 'Bob', winner: 'A' })],
    })
    renderWithI18n(
      <BracketView bracket={b} courts={[]} resetToken={null} {...handlers} onUndo={onUndo} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }))
    expect(onUndo).toHaveBeenCalledWith('R2-M1')
  })
})

describe('BracketView — error display', () => {
  it('renders a translated error alert and allows dismissing it', () => {
    const onClearError = vi.fn()
    renderWithI18n(
      <BracketView
        bracket={makeBracket()}
        courts={[]}
        error={{ code: 'INVALID_SIZE', message: 'bad' }}
        resetToken={null}
        {...handlers}
        onClearError={onClearError}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Tamaño de bracket inválido/i)
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }))
    expect(onClearError).toHaveBeenCalledTimes(1)
  })
})

describe('BracketView — 2-step reset', () => {
  it('step 1: clicking "Reiniciar bracket" opens the first confirm; confirming calls onReset', () => {
    const onReset = vi.fn()
    renderWithI18n(
      <BracketView bracket={makeBracket()} courts={[]} resetToken={null} {...handlers} onReset={onReset} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar bracket/i }))
    expect(screen.getByText(/Vas a borrar todo el bracket/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('step 2: when resetToken arrives, shows the final confirm; confirming calls onResetConfirm(token)', () => {
    const onResetConfirm = vi.fn()
    renderWithI18n(
      <BracketView
        bracket={makeBracket()}
        courts={[]}
        resetToken="tok-abc"
        {...handlers}
        onResetConfirm={onResetConfirm}
      />,
    )
    expect(screen.getByText(/Confirmá el reinicio del bracket/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Reiniciar ahora$/i }))
    expect(onResetConfirm).toHaveBeenCalledWith('tok-abc')
  })
})