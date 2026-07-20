/**
 * ClubSessionConfig — initial mode selector shown on JOIN before any play.
 *
 * Spec scenarios covered: 1 (Start free play), 2 (Start match from config).
 * Component contract:
 *   - Two selectable mode cards: "🎯 Modo Libre" and "🏆 Modo Match"
 *   - "Comenzar" button disabled until a mode is selected
 *   - On "Comenzar" → emits onSelectFree for free, onSelectMatch for match
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClubSessionConfig } from './ClubSessionConfig'

// Minimal i18n mock — the component reads via useI18n().
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubPlaySessionConfigTitle: '¿Cómo van a jugar?',
        clubPlayModeFree: '🎯 Modo Libre',
        clubPlayModeFreeDesc: 'Sin puntuación',
        clubPlayModeMatch: '🏆 Modo Match',
        clubPlayModeMatchDesc: 'Partido con puntuación',
        clubPlayModeStart: 'Comenzar',
      }
      return map[key] || key
    },
  }),
}))

function renderComponent(overrides: { onSelectFree?: () => void; onSelectMatch?: () => void } = {}) {
  const onSelectFree = overrides.onSelectFree ?? vi.fn()
  const onSelectMatch = overrides.onSelectMatch ?? vi.fn()
  const result = render(
    <ClubSessionConfig onSelectFree={onSelectFree} onSelectMatch={onSelectMatch} />,
  )
  return { onSelectFree, onSelectMatch, ...result }
}

describe('ClubSessionConfig', () => {
  it('renders both mode options with labels and descriptions', () => {
    renderComponent()
    expect(screen.getByText('🎯 Modo Libre')).toBeInTheDocument()
    expect(screen.getByText('Sin puntuación')).toBeInTheDocument()
    expect(screen.getByText('🏆 Modo Match')).toBeInTheDocument()
    expect(screen.getByText('Partido con puntuación')).toBeInTheDocument()
  })

  it('renders the config title', () => {
    renderComponent()
    expect(screen.getByText('¿Cómo van a jugar?')).toBeInTheDocument()
  })

  it('Comenzar is disabled before a mode is selected', () => {
    renderComponent()
    const start = screen.getByRole('button', { name: /Comenzar/ })
    expect(start).toBeDisabled()
  })

  it('selecting free and pressing Comenzar emits onSelectFree', () => {
    const { onSelectFree, onSelectMatch } = renderComponent()
    fireEvent.click(screen.getByText('🎯 Modo Libre'))
    fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))

    expect(onSelectFree).toHaveBeenCalledTimes(1)
    expect(onSelectMatch).not.toHaveBeenCalled()
  })

  it('selecting match and pressing Comenzar emits onSelectMatch', () => {
    const { onSelectFree, onSelectMatch } = renderComponent()
    fireEvent.click(screen.getByText('🏆 Modo Match'))
    fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))

    expect(onSelectMatch).toHaveBeenCalledTimes(1)
    expect(onSelectFree).not.toHaveBeenCalled()
  })

  it('Comenzar becomes enabled after a mode is selected', () => {
    renderComponent()
    const start = screen.getByRole('button', { name: /Comenzar/ })
    expect(start).toBeDisabled()
    fireEvent.click(screen.getByText('🎯 Modo Libre'))
    expect(start).not.toBeDisabled()
  })

  it('switching selection overrides previously-selected mode', () => {
    const { onSelectFree, onSelectMatch } = renderComponent()
    fireEvent.click(screen.getByText('🎯 Modo Libre'))
    fireEvent.click(screen.getByText('🏆 Modo Match'))
    fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))

    expect(onSelectMatch).toHaveBeenCalledTimes(1)
    expect(onSelectFree).not.toHaveBeenCalled()
  })
})