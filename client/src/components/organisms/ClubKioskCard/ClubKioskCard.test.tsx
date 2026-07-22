import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClubKioskCard } from './ClubKioskCard'
import type { ClubKioskCourtInfo } from '@shared/types'

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubKioskAvailable: 'Disponible',
        clubKioskReserved: 'Reservada',
        clubKioskOccupied: 'En Juego',
        clubKioskFinished: 'Finalizada',
        clubKioskFreeBadge: '🟢 En cancha — Modo Libre',
        commonVs: 'vs',
      }
      return map[key] || key
    },
  }),
  changeLanguage: vi.fn(),
}))

function makeCourt(overrides: Partial<ClubKioskCourtInfo> = {}): ClubKioskCourtInfo {
  return {
    id: 'court-1',
    name: 'Cancha 1',
    status: 'AVAILABLE',
    mode: 'club',
    ...overrides,
  }
}

describe('ClubKioskCard', () => {
  it('renders AVAILABLE with green styling and Disponible badge', () => {
    render(<ClubKioskCard court={makeCourt({ status: 'AVAILABLE' })} />)
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
  })

  it('renders RESERVED with large PIN display', () => {
    render(<ClubKioskCard court={makeCourt({ status: 'RESERVED', pin: '1234' })} />)
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Reservada')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
  })

  it('does not show PIN when RESERVED but pin is undefined', () => {
    render(<ClubKioskCard court={makeCourt({ status: 'RESERVED', pin: undefined })} />)
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Reservada')).toBeInTheDocument()
    // Should not render PIN section
    expect(screen.queryByText(/^\d{4}$/)).not.toBeInTheDocument()
  })

  it('renders OCCUPIED with player names and score', () => {
    render(
      <ClubKioskCard
        court={makeCourt({
          status: 'OCCUPIED',
          playerNames: { a: 'Alice', b: 'Bob' },
          currentScore: { a: 5, b: 3 },
        })}
      />,
    )
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('En Juego')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders FINISHED with final score', () => {
    render(
      <ClubKioskCard
        court={makeCourt({
          status: 'FINISHED',
          playerNames: { a: 'Alice', b: 'Bob' },
          currentScore: { a: 11, b: 7 },
        })}
      />,
    )
    expect(screen.getByText('Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Finalizada')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders score defaults when OCCUPIED without currentScore', () => {
    render(
      <ClubKioskCard
        court={makeCourt({
          status: 'OCCUPIED',
          playerNames: { a: 'Alice', b: 'Bob' },
          currentScore: undefined,
        })}
      />,
    )
    // Defaults to 0-0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  // ── Phase 6.5 playerName display ─────────────────────────────────
  describe('playerName display (Phase 6.5)', () => {
    it('shows playerName next to court name when OCCUPIED with playerName', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            playerName: 'Juan Pérez',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: { a: 5, b: 3 },
          })}
        />,
      )
      expect(screen.getByText('Cancha 1')).toBeInTheDocument()
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    })

    it('shows playerName in free mode when present', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            sessionMode: 'free',
            playerName: 'Juan Pérez',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: undefined,
          })}
        />,
      )
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    })

    it('does not show playerName on AVAILABLE courts', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'AVAILABLE',
            playerName: 'Juan Pérez',
          })}
        />,
      )
      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
    })

    it('does not show playerName on RESERVED courts', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'RESERVED',
            pin: '1234',
            playerName: 'Juan Pérez',
          })}
        />,
      )
      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
    })

    it('does not show playerName on FINISHED courts', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'FINISHED',
            playerName: 'Juan Pérez',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: { a: 11, b: 7 },
          })}
        />,
      )
      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
    })
  })

  // ── PR 4 free-mode behavior ───────────────────────────────────────
  describe('free-mode (sessionMode === free) — spec task 4.7', () => {
    it('shows the "En cancha — Modo Libre" badge instead of "En Juego"', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            sessionMode: 'free',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: { a: 5, b: 3 },
          })}
        />,
      )
      expect(screen.getByText('🟢 En cancha — Modo Libre')).toBeInTheDocument()
      expect(screen.queryByText('En Juego')).not.toBeInTheDocument()
    })

    it('does not show score numbers in free mode', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            sessionMode: 'free',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: { a: 5, b: 3 },
          })}
        />,
      )
      // Score A=5 and B=3 MUST NOT render in free mode.
      expect(screen.queryByText('5')).not.toBeInTheDocument()
      expect(screen.queryByText('3')).not.toBeInTheDocument()
    })

    it('still shows player names in free mode', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            sessionMode: 'free',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: undefined,
          })}
        />,
      )
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('does not render scores when currentScore is omitted in free mode', () => {
      const { container } = render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            sessionMode: 'free',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: undefined,
          })}
        />,
      )
      // No score-number containers should render in free mode — assert via
      // data-testid absence.
      const scoreNumbers = container.querySelectorAll('[data-testid^="score-"]')
      expect(scoreNumbers).toHaveLength(0)
    })

    it('shows scores when sessionMode is match (anchoring the match-mode behavior)', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            sessionMode: 'match',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: { a: 5, b: 3 },
          })}
        />,
      )
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('shows scores when sessionMode is omitted (legacy/OCCUPIED)', () => {
      render(
        <ClubKioskCard
          court={makeCourt({
            status: 'OCCUPIED',
            playerNames: { a: 'Alice', b: 'Bob' },
            currentScore: { a: 5, b: 3 },
          })}
        />,
      )
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })
})
