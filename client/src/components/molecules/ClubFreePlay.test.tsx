/**
 * ClubFreePlay — free-mode session screen (timer + names + buttons, no score).
 *
 * Spec task 4.3 + design doc "Modo Libre".
 * Spec contract: Free mode MUST display timer + player names, MUST NOT
 * display scoring. Buttons: "Jugar partido" (open match config) +
 * "Terminar sesión" (end-session flow).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClubFreePlay } from './ClubFreePlay'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubPlayFreeBadge: '🟢 En cancha — Modo Libre',
        clubPlayPlayMatch: '🏆 Jugar partido',
        clubPlayEndSessionBtn: '⏹ Terminar sesión',
        clubPlayTimerLabel: 'Tiempo',
        clubPlayNameA: 'Jugador 1',
        clubPlayNameB: 'Jugador 2',
        commonVs: 'vs',
      }
      return map[key] || key
    },
  }),
}))

function renderComponent(overrides: {
  elapsedSeconds?: number
  playerNameA?: string
  playerNameB?: string
  onPlayMatch?: () => void
  onEndSession?: () => void
} = {}) {
  const onPlayMatch = overrides.onPlayMatch ?? vi.fn()
  const onEndSession = overrides.onEndSession ?? vi.fn()
  const result = render(
    <ClubFreePlay
      elapsedSeconds={overrides.elapsedSeconds ?? 0}
      playerNameA={overrides.playerNameA}
      playerNameB={overrides.playerNameB}
      onPlayMatch={onPlayMatch}
      onEndSession={onEndSession}
    />,
  )
  return { onPlayMatch, onEndSession, ...result }
}

describe('ClubFreePlay', () => {
  it('renders the free-mode badge', () => {
    renderComponent()
    expect(screen.getByText('🟢 En cancha — Modo Libre')).toBeInTheDocument()
  })

  it('renders the "Jugar partido" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Jugar partido/ })).toBeInTheDocument()
  })

  it('renders the "Terminar sesión" button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Terminar sesión/ })).toBeInTheDocument()
  })

  it('clicking "Jugar partido" emits onPlayMatch', () => {
    const { onPlayMatch } = renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Jugar partido/ }))
    expect(onPlayMatch).toHaveBeenCalledTimes(1)
  })

  it('clicking "Terminar sesión" emits onEndSession', () => {
    const { onEndSession } = renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Terminar sesión/ }))
    expect(onEndSession).toHaveBeenCalledTimes(1)
  })

  it('formats 0 elapsed seconds as 00:00', () => {
    renderComponent({ elapsedSeconds: 0 })
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('formats 923 seconds as 15:23 (triangulation)', () => {
    renderComponent({ elapsedSeconds: 923 })
    expect(screen.getByText('15:23')).toBeInTheDocument()
  })

  it('formats 3661 seconds as 01:01:01 (HH:MM:SS rollover)', () => {
    renderComponent({ elapsedSeconds: 3661 })
    expect(screen.getByText('01:01:01')).toBeInTheDocument()
  })

  it('renders provided player names when supplied', () => {
    renderComponent({ playerNameA: 'Alice', playerNameB: 'Bob' })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('falls back to i18n placeholder names when names are missing', () => {
    renderComponent()
    expect(screen.getByText('Jugador 1')).toBeInTheDocument()
    expect(screen.getByText('Jugador 2')).toBeInTheDocument()
  })

  it('renders player A name only when playerNameB is missing (partial names)', () => {
    renderComponent({ playerNameA: 'Alice' })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Jugador 2')).toBeInTheDocument()
  })

  it('does not render any score display', () => {
    // Free mode MUST NOT display scoring. Confirm there is no element
    // whose role/text pattern would be a score row.
    const { container } = renderComponent()
    // No element with aria-label indicating a score ( typical scoring
    // patterns use role="status" with values). We assert no element with
    // data-testid starting with "score-".
    const scoreNodes = container.querySelectorAll('[data-testid^="score"]')
    expect(scoreNodes).toHaveLength(0)
  })
})