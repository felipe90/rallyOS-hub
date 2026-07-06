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
})
