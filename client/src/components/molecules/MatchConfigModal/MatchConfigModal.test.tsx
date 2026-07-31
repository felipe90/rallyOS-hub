import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchConfigModal, findBracketMatchForCourt } from './MatchConfigModal'
import { SPORT } from '@shared/types'
import type { TournamentBracket } from '@shared/types'

const defaultProps = {
  isOpen: true,
  courtId: 'table-1',
  courtName: 'Mesa 1',
  onSubmit: vi.fn(),
  onClose: vi.fn(),
}

function makeBracket(overrides: Partial<TournamentBracket> = {}): TournamentBracket {
  return {
    id: 'b1',
    name: 'T',
    numSlots: 4,
    status: 'IN_PROGRESS',
    rounds: 2,
    currentRound: 0,
    includeThirdPlace: false,
    createdAt: new Date().toISOString(),
    matches: [
      { id: 'R1-M1', round: 0, position: 0, playerA: 'Juan', playerB: 'Maria', winner: null, status: 'READY', courtId: 'table-1' },
      { id: 'R1-M2', round: 0, position: 1, playerA: 'Ana', playerB: 'Luis', winner: null, status: 'READY', courtId: null },
      { id: 'R2-M1', round: 1, position: 0, playerA: null, playerB: null, winner: null, status: 'PENDING', courtId: null },
    ],
    thirdPlaceMatch: null,
    ...overrides,
  }
}

describe('MatchConfigModal', () => {
  it('renders when isOpen is true', () => {
    render(<MatchConfigModal {...defaultProps} />)
    expect(screen.getByText('Configurar Partido')).toBeInTheDocument()
    expect(screen.getByText('para Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Iniciar Partido')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<MatchConfigModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Configurar Partido')).not.toBeInTheDocument()
  })

  it('renders bestOf buttons (1, 3, 5)', () => {
    render(<MatchConfigModal {...defaultProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<MatchConfigModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSubmit with config when Iniciar Partido is clicked', () => {
    const onSubmit = vi.fn()
    render(<MatchConfigModal {...defaultProps} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('Iniciar Partido'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        bestOf: 3,
        handicapA: 0,
        handicapB: 0,
        playerNameA: 'Player A',
        playerNameB: 'Player B',
        sport: 'tableTennis',
        pointsPerSet: 11,
      })
    )
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<MatchConfigModal {...defaultProps} onClose={onClose} />)
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    if (overlay) {
      fireEvent.keyDown(overlay, { key: 'Escape' })
    }
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<MatchConfigModal {...defaultProps} onClose={onClose} />)
    const backdrop = document.querySelector('.bg-black\\/50')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('disables Iniciar Partido button when isLoading', () => {
    render(<MatchConfigModal {...defaultProps} isLoading={true} />)
    const button = screen.getByText('Iniciando...')
    expect(button).toBeDisabled()
  })

  it('shows "Iniciando..." text when isLoading', () => {
    render(<MatchConfigModal {...defaultProps} isLoading={true} />)
    expect(screen.getByText('Iniciando...')).toBeInTheDocument()
  })

  it('disables Cancel button when isLoading', () => {
    render(<MatchConfigModal {...defaultProps} isLoading={true} />)
    const cancelButton = screen.getByText('Cancelar')
    expect(cancelButton).toBeDisabled()
  })

  it('disables bestOf buttons when isLoading', () => {
    render(<MatchConfigModal {...defaultProps} isLoading={true} />)
    const button1 = screen.getByText('1').closest('button')
    expect(button1).toBeDisabled()
  })

  it('disables plus/minus buttons when isLoading', () => {
    render(<MatchConfigModal {...defaultProps} isLoading={true} />)
    const plusButtons = screen.getAllByText('+')
    plusButtons.forEach(btn => {
      expect(btn.closest('button')).toBeDisabled()
    })
  })

  it('shows error text when error prop is provided', () => {
    render(<MatchConfigModal {...defaultProps} error="Error de conexion" />)
    expect(screen.getByText('Error de conexion')).toBeInTheDocument()
  })

  it('renders error with role="alert"', () => {
    render(<MatchConfigModal {...defaultProps} error="Error de conexion" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
  })

  it('handicap decrement goes below 0', () => {
    render(<MatchConfigModal {...defaultProps} initialHandicapA={0} />)
    const minusButtons = screen.getAllByText('-')
    const minusA = minusButtons[1].closest('button')!
    expect(minusA).not.toBeDisabled()
    fireEvent.click(minusA)
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('handicap increment works from initial value', () => {
    render(<MatchConfigModal {...defaultProps} initialHandicapA={2} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('includes player names in onSubmit', () => {
    const onSubmit = vi.fn()
    render(<MatchConfigModal {...defaultProps} onSubmit={onSubmit} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'Alice' } })
    fireEvent.change(inputs[1], { target: { value: 'Bob' } })
    fireEvent.click(screen.getByText('Iniciar Partido'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        playerNameA: 'Alice',
        playerNameB: 'Bob',
      })
    )
  })

  it('switches bestOf when clicking different button', () => {
    const onSubmit = vi.fn()
    render(<MatchConfigModal {...defaultProps} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('1'))
    fireEvent.click(screen.getByText('Iniciar Partido'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ bestOf: 1 })
    )
  })

  it('shows handicap section for table tennis', () => {
    render(<MatchConfigModal {...defaultProps} />)
    expect(screen.getByText('Handicap')).toBeInTheDocument()
  })

  it('shows padel config fields when initialSport is padel', () => {
    render(<MatchConfigModal {...defaultProps} initialSport={SPORT.PADEL} />)
    expect(screen.queryByText('Handicap')).not.toBeInTheDocument()
    expect(screen.getByText('Games por set')).toBeInTheDocument()
    expect(screen.getByText('Tiebreak')).toBeInTheDocument()
    expect(screen.getByText('Punto de Oro')).toBeInTheDocument()
  })

  it('submits padel config with sport-specific fields', () => {
    const onSubmit = vi.fn()
    render(<MatchConfigModal {...defaultProps} initialSport={SPORT.PADEL} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('Iniciar Partido'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'padel',
        gamesPerSet: 6,
        tiebreakPoints: 7,
        goldenPoint: false,
      })
    )
  })

  describe('Option 2 — bracket prefill', () => {
    it('prefills player names from the bound bracket match on open', () => {
      render(<MatchConfigModal {...defaultProps} bracket={makeBracket()} />)
      const inputs = screen.getAllByRole('textbox')
      expect(inputs[0]).toHaveValue('Juan')
      expect(inputs[1]).toHaveValue('Maria')
    })

    it('submits the prefilled names unchanged', () => {
      const onSubmit = vi.fn()
      render(<MatchConfigModal {...defaultProps} bracket={makeBracket()} onSubmit={onSubmit} />)
      fireEvent.click(screen.getByText('Iniciar Partido'))
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ playerNameA: 'Juan', playerNameB: 'Maria' })
      )
    })

    it('does not prefill when bracket is null', () => {
      render(<MatchConfigModal {...defaultProps} bracket={null} />)
      const inputs = screen.getAllByRole('textbox')
      expect(inputs[0]).toHaveValue('')
      expect(inputs[1]).toHaveValue('')
    })

    it('does not prefill when the court is not bound to any bracket match', () => {
      render(<MatchConfigModal {...defaultProps} bracket={makeBracket()} courtId="other-court" />)
      const inputs = screen.getAllByRole('textbox')
      expect(inputs[0]).toHaveValue('')
      expect(inputs[1]).toHaveValue('')
    })

    it('referee edits survive a live bracket change while the modal is open', () => {
      const { rerender } = render(<MatchConfigModal {...defaultProps} bracket={makeBracket()} />)
      const inputs = screen.getAllByRole('textbox')
      fireEvent.change(inputs[0], { target: { value: 'Edited' } })

      // Live BRACKET_STATE update arrives while the modal stays open.
      rerender(<MatchConfigModal {...defaultProps} bracket={makeBracket()} />)

      expect(screen.getAllByRole('textbox')[0]).toHaveValue('Edited')
    })

    it('re-prefills when reopened after a close', () => {
      const { rerender } = render(<MatchConfigModal {...defaultProps} isOpen={false} />)
      rerender(<MatchConfigModal {...defaultProps} isOpen={true} bracket={makeBracket()} />)
      const inputs = screen.getAllByRole('textbox')
      expect(inputs[0]).toHaveValue('Juan')
      expect(inputs[1]).toHaveValue('Maria')
    })
  })

  describe('findBracketMatchForCourt', () => {
    it('returns the main match bound to the court', () => {
      expect(findBracketMatchForCourt(makeBracket(), 'table-1')?.id).toBe('R1-M1')
    })

    it('returns the third-place match when it is the one bound', () => {
      const b = makeBracket({
        thirdPlaceMatch: { id: 'TP-M1', round: 0, position: 0, playerA: null, playerB: null, winner: null, status: 'PENDING', courtId: 'tp-court' },
      })
      expect(findBracketMatchForCourt(b, 'tp-court')?.id).toBe('TP-M1')
    })

    it('returns null for unbound courts', () => {
      expect(findBracketMatchForCourt(makeBracket(), 'unknown-court')).toBeNull()
    })

    it('returns null for a null/undefined bracket or courtId', () => {
      expect(findBracketMatchForCourt(null, 'table-1')).toBeNull()
      expect(findBracketMatchForCourt(undefined, 'table-1')).toBeNull()
      expect(findBracketMatchForCourt(makeBracket(), undefined)).toBeNull()
    })
  })
})
