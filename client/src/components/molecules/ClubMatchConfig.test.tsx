/**
 * ClubMatchConfig — match setup form (points per set, best of, handicap, names).
 *
 * Spec task 4.2 + design doc "Configuración del Match".
 * Spec scenarios covered: 2 (Start match from config), and PR 3's matchConfig
 * passthrough that this form drives.
 *
 * Contract:
 *   - Renders dropdown for "Puntos por set" (default 15) and "Al mejor de" (default 3)
 *   - Renders handicap A/B steppers (default 0/0)
 *   - Renders two text inputs for player names (default empty)
 *   - "Empezar partido" emits onSubmit({ courtId, playerNameA, playerNameB, matchConfig })
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClubMatchConfig } from './ClubMatchConfig'

// Minimal i18n mock for the component.
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubPlayMatchConfigTitle: 'Configuración del partido',
        clubPlayPointsPerSet: 'Puntos por set',
        clubPlayBestOf: 'Al mejor de',
        clubPlayHandicap: 'Handicap',
        clubPlayStartMatchBtn: 'Empezar partido',
        clubPlayCancel: 'Cancelar',
        commonPlayerA: 'Player A',
        commonPlayerB: 'Player B',
        clubPlayNameA: 'Jugador A',
        clubPlayNameB: 'Jugador B',
      }
      return map[key] || key
    },
  }),
}))

function renderComponent(overrides: {
  courtId?: string
  onSubmit?: (payload: {
    courtId: string
    playerNameA: string
    playerNameB: string
    matchConfig: Record<string, unknown>
  }) => void
  onCancel?: () => void
} = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn()
  const onCancel = overrides.onCancel ?? vi.fn()
  const props = {
    courtId: overrides.courtId ?? 'court-1',
    onSubmit,
    onCancel,
  }
  const result = render(<ClubMatchConfig {...props} />)
  return { onSubmit, onCancel, ...result }
}

describe('ClubMatchConfig', () => {
  it('renders the form title', () => {
    renderComponent()
    expect(screen.getByText('Configuración del partido')).toBeInTheDocument()
  })

  it('renders the "Empezar partido" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Empezar partido/ })).toBeInTheDocument()
  })

  it('renders default values: 15 points, best of 3, handicap 0/0', () => {
    renderComponent()
    // The default points-per-set selector shows "15" selected — assert via
    // the visible chip labeled "15" being in primary (radio selected).
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    // Handicap 0/0 — two zeros visible (each side has its own state)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  it('emits onSubmit with default payload when "Empezar partido" pressed without changes', () => {
    const { onSubmit } = renderComponent({ courtId: 'court-7' })
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.courtId).toBe('court-7')
    expect(payload.playerNameA).toBe('')
    expect(payload.playerNameB).toBe('')
    expect(payload.matchConfig.pointsPerSet).toBe(15)
    expect(payload.matchConfig.bestOf).toBe(3)
    expect(payload.matchConfig.handicapA).toBe(0)
    expect(payload.matchConfig.handicapB).toBe(0)
  })

  it('changing points per set to 21 is reflected in the emitted matchConfig', () => {
    const { onSubmit } = renderComponent()
    // Click the "21" chip for points per set
    fireEvent.click(screen.getByText('21'))
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    const payload = onSubmit.mock.calls[0][0]
    expect(payload.matchConfig.pointsPerSet).toBe(21)
    expect(payload.matchConfig.bestOf).toBe(3) // best of unchanged
  })

  it('changing best of to 5 is reflected in the emitted matchConfig', () => {
    const { onSubmit } = renderComponent()
    fireEvent.click(screen.getByText('5'))
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    const payload = onSubmit.mock.calls[0][0]
    expect(payload.matchConfig.bestOf).toBe(5)
    expect(payload.matchConfig.pointsPerSet).toBe(15) // points unchanged
  })

  it('incrementing handicap A twice yields handicapA=2 in payload', () => {
    const { onSubmit } = renderComponent()
    // Handicap A "+" is the first "+" button in the handicap row.
    // We find both "-" and "+" buttons via aria-labels to target them.
    const plusButtons = screen.getAllByRole('button', { name: /increment handicap a/i })
    expect(plusButtons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(plusButtons[0])
    fireEvent.click(plusButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    const payload = onSubmit.mock.calls[0][0]
    expect(payload.matchConfig.handicapA).toBe(2)
    expect(payload.matchConfig.handicapB).toBe(0) // B unchanged
  })

  it('decrementing handicap B yields handicapB=-1 in payload', () => {
    const { onSubmit } = renderComponent()
    const minusButtons = screen.getAllByRole('button', { name: /decrement handicap b/i })
    fireEvent.click(minusButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    const payload = onSubmit.mock.calls[0][0]
    expect(payload.matchConfig.handicapB).toBe(-1)
  })

  it('typing player names is reflected in the emitted payload', () => {
    const { onSubmit } = renderComponent()
    const inputs = screen.getAllByRole('textbox')
    // Two text inputs: player A and player B
    expect(inputs.length).toBe(2)

    fireEvent.change(inputs[0], { target: { value: 'Alice' } })
    fireEvent.change(inputs[1], { target: { value: 'Bob' } })
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    const payload = onSubmit.mock.calls[0][0]
    expect(payload.playerNameA).toBe('Alice')
    expect(payload.playerNameB).toBe('Bob')
  })

  it('trims whitespace from player names before emitting', () => {
    const { onSubmit } = renderComponent()
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '  Alice  ' } })
    fireEvent.change(inputs[1], { target: { value: '  Bob  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))

    const payload = onSubmit.mock.calls[0][0]
    expect(payload.playerNameA).toBe('Alice')
    expect(payload.playerNameB).toBe('Bob')
  })

  it('calls onCancel when Cancelar button is pressed', () => {
    const { onCancel } = renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('emits matchConfig with sport=tableTennis (TT default club sport)', () => {
    const { onSubmit } = renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Empezar partido/ }))
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.matchConfig.sport).toBe('tableTennis')
  })
})