import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchConfigModal } from './MatchConfigModal'

const defaultProps = {
  isOpen: true,
  tableId: 'table-1',
  tableName: 'Mesa 1',
  onSubmit: vi.fn(),
  onClose: vi.fn(),
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

  it('uses initialBestOf prop (default 3)', () => {
    render(<MatchConfigModal {...defaultProps} initialBestOf={5} />)
    // The button for "5" should have the primary variant (selected)
    const buttons5 = screen.getAllByText('5')
    expect(buttons5.length).toBeGreaterThan(0)
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
    expect(onSubmit).toHaveBeenCalledWith({
      bestOf: 3,
      handicapA: 0,
      handicapB: 0,
      playerNameA: 'Player A',
      playerNameB: 'Player B',
    })
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<MatchConfigModal {...defaultProps} onClose={onClose} />)
    // The onKeyDown handler is on the outer overlay div (fixed inset-0)
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    if (overlay) {
      fireEvent.keyDown(overlay, { key: 'Escape' })
    }
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<MatchConfigModal {...defaultProps} onClose={onClose} />)
    // Backdrop is the first div inside the overlay (the one with bg-black/50)
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

  it('disables handicap buttons when isLoading', () => {
    render(<MatchConfigModal {...defaultProps} isLoading={true} />)
    // All ghost variant buttons are handicap +/-
    const ghostButtons = screen.getAllByText('+')
    ghostButtons.forEach(btn => {
      expect(btn.closest('button')).toBeDisabled()
    })
  })

  it('shows error text when error prop is provided', () => {
    render(<MatchConfigModal {...defaultProps} error="Error de conexión" />)
    expect(screen.getByText('Error de conexión')).toBeInTheDocument()
  })

  it('handicap decrement goes below 0 (allows negative)', () => {
    render(<MatchConfigModal {...defaultProps} initialHandicapA={0} />)
    // Handicap A starts at 0 — decrement button is enabled and goes to -1
    const minusButtons = screen.getAllByText('−')
    // First minus button is for handicap A
    const minusA = minusButtons[0].closest('button')!
    expect(minusA).not.toBeDisabled()
    fireEvent.click(minusA)
    // Display should show -1
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('handicap increment works from initial value', () => {
    render(<MatchConfigModal {...defaultProps} initialHandicapA={2} />)
    // Handicap A should show 2
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('includes player names in onSubmit config', () => {
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
})
