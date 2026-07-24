/**
 * ClubEndSessionConfirm — end-session confirmation modal.
 *
 * Spec task 4.4 + spec scenario 5 (Player ends session).
 * Spec contract: show elapsed time; "Sí, terminar" emits confirm=true;
 * "Cancelar" emits confirm=false OR cancelEndSession locally.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClubEndSessionConfirm } from './ClubEndSessionConfirm'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubPlayEndSessionTitle: '⏹ Terminar sesión',
        clubPlayElapsedTimeLabel: 'Tiempo transcurrido:',
        clubPlayConfirmEnd: 'Sí, terminar',
        clubPlayCancel: 'Cancelar',
      }
      return map[key] || key
    },
  }),
}))

function renderComponent(overrides: {
  isOpen?: boolean
  elapsedSeconds?: number
  onConfirm?: () => void
  onCancel?: () => void
} = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn()
  const onCancel = overrides.onCancel ?? vi.fn()
  const result = render(
    <ClubEndSessionConfirm
      isOpen={overrides.isOpen ?? true}
      elapsedSeconds={overrides.elapsedSeconds ?? 0}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel, ...result }
}

describe('ClubEndSessionConfirm', () => {
  it('renders the title when open', () => {
    renderComponent()
    expect(screen.getByText('⏹ Terminar sesión')).toBeInTheDocument()
  })

  it('renders the "Sí, terminar" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Sí, terminar/ })).toBeInTheDocument()
  })

  it('renders the "Cancelar" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Cancelar/ })).toBeInTheDocument()
  })

  it('renders the elapsed time label', () => {
    renderComponent()
    expect(screen.getByText('Tiempo transcurrido:')).toBeInTheDocument()
  })

  it('formats 0 seconds as 00:00', () => {
    renderComponent({ elapsedSeconds: 0 })
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('formats 2712 seconds as 45:12 (triangulation)', () => {
    renderComponent({ elapsedSeconds: 2712 })
    expect(screen.getByText('45:12')).toBeInTheDocument()
  })

  it('formats 4200 seconds as 01:10:00 (HH:MM:SS rollover)', () => {
    renderComponent({ elapsedSeconds: 4200 })
    expect(screen.getByText('01:10:00')).toBeInTheDocument()
  })

  it('does not render anything when isOpen=false', () => {
    renderComponent({ isOpen: false })
    expect(screen.queryByText('⏹ Terminar sesión')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sí, terminar/ })).not.toBeInTheDocument()
  })

  it('clicking "Sí, terminar" calls onConfirm', () => {
    const { onConfirm } = renderComponent({ elapsedSeconds: 600 })
    fireEvent.click(screen.getByRole('button', { name: /Sí, terminar/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('clicking "Cancelar" calls onCancel', () => {
    const { onCancel } = renderComponent({ elapsedSeconds: 600 })
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders as a modal dialog with role alertdialog', () => {
    renderComponent()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})