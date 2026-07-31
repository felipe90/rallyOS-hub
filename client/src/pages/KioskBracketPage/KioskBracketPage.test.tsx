import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { KioskBracketPage } from './KioskBracketPage'
import { useSocketContext } from '@/contexts/SocketContext'
import { BRACKET_STATUS, BRACKET_MATCH_STATUS } from '@shared/types'
import type { TournamentBracket, BracketMatch } from '@shared/types'

// Mock SocketContext — the page reads `bracket` (lifted state) from here.
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock useI18n — return a stable Spanish map so assertions can use real text.
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => I18N_MAP[key] ?? key,
  }),
  changeLanguage: vi.fn(),
}))

// Mock KioskHeader so the test doesn't pull in QR/logo rendering.
vi.mock('@/components/molecules/KioskHeader', () => ({
  KioskHeader: () => <header data-testid="kiosk-header">Header</header>,
}))

const I18N_MAP: Record<string, string> = {
  kioskBracketWaiting: 'Esperando bracket...',
  kioskBracketChampion: 'Campeón',
  kioskBracketRunnerUp: 'Subcampeón',
  bracketRoundThirdPlace: '3er Puesto',
  bracketRoundFinal: 'Final',
  bracketRoundSemi: 'Semis',
  bracketRoundQuarter: 'Cuartos',
  bracketRoundR16: 'R16',
  bracketRoundR32: 'R32',
  authTournament: 'Torneo',
}

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

function mkMatch(
  id: string,
  round: number,
  position: number,
  overrides: Partial<BracketMatch> = {},
): BracketMatch {
  const winner = overrides.winner ?? null
  const status = overrides.status ?? (winner ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.PENDING)
  return {
    playerA: null,
    playerB: null,
    courtId: null,
    ...overrides,
    status,
    id,
    round,
    position,
  } as BracketMatch
}

/** A 4-slot bracket with the two semifinals + the final (R2-M1). */
function bracket4(opts: {
  finalA: string | null
  finalB: string | null
  finalWinner: 'A' | 'B' | null
  status: TournamentBracket['status']
  thirdPlace?: { a: string | null; b: string | null; winner: 'A' | 'B' | null }
}): TournamentBracket {
  const finalMatch = mkMatch('R2-M1', 2, 0, {
    playerA: opts.finalA,
    playerB: opts.finalB,
    winner: opts.finalWinner,
    status: opts.finalWinner ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.PENDING,
  })
  const semi1 = mkMatch('R1-M1', 1, 0, {
    playerA: opts.finalA,
    playerB: 'SF1B',
    winner: opts.finalWinner ? 'A' : null,
    status: opts.finalWinner ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.PENDING,
  })
  const semi2 = mkMatch('R1-M2', 1, 1, {
    playerA: opts.finalB,
    playerB: 'SF2B',
    winner: opts.finalWinner ? (opts.finalWinner === 'A' ? 'B' : 'A') : null,
    status: opts.finalWinner ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.PENDING,
  })
  const thirdPlaceMatch = opts.thirdPlace
    ? mkMatch('TP-M1', 3, 0, {
        playerA: opts.thirdPlace.a,
        playerB: opts.thirdPlace.b,
        winner: opts.thirdPlace.winner,
        status: opts.thirdPlace.winner ? BRACKET_MATCH_STATUS.COMPLETED : BRACKET_MATCH_STATUS.READY,
      })
    : null
  return {
    name: 'Cuadro Principal',
    numSlots: 4,
    includeThirdPlace: !!opts.thirdPlace,
    matches: [semi1, semi2, finalMatch],
    thirdPlaceMatch,
    status: opts.status,
    createdAt: 1,
  }
}

function renderPage(bracket: TournamentBracket | null) {
  mockUseSocketContext.mockReturnValue({
    bracket,
    hubConfig: null,
    connected: true,
    connecting: false,
  })
  return render(
    <MemoryRouter>
      <KioskBracketPage />
    </MemoryRouter>,
  )
}

describe('KioskBracketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the waiting state when there is no bracket (null)', () => {
    renderPage(null)
    expect(screen.getByText('Esperando bracket...')).toBeInTheDocument()
    // No podium or tree while waiting.
    expect(screen.queryByText('Campeón')).not.toBeInTheDocument()
    expect(screen.queryByText('R1-M1')).not.toBeInTheDocument()
  })

  it('renders the bracket tree (read-only) when status is SETUP, no podium', () => {
    const bracket = bracket4({
      finalA: 'Juan',
      finalB: 'Maria',
      finalWinner: null,
      status: BRACKET_STATUS.SETUP,
    })
    renderPage(bracket)

    // Round labels + match ids are rendered.
    expect(screen.getByText('Semis')).toBeInTheDocument()
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.getByText('R1-M1')).toBeInTheDocument()
    // 'Juan' appears in both a semifinal and the final slot — assert presence.
    expect(screen.getAllByText('Juan').length).toBeGreaterThan(0)

    // No podium while not completed.
    expect(screen.queryByRole('region', { name: 'podium' })).not.toBeInTheDocument()
  })

  it('renders the bracket tree when status is ACTIVE, no podium', () => {
    const bracket = bracket4({
      finalA: 'Juan',
      finalB: 'Maria',
      finalWinner: null,
      status: BRACKET_STATUS.ACTIVE,
    })
    renderPage(bracket)

    expect(screen.getByText('R2-M1')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'podium' })).not.toBeInTheDocument()
  })

  it('renders the podium as protagonist + compact tree when COMPLETED (no third place)', () => {
    const bracket = bracket4({
      finalA: 'Champ',
      finalB: 'Runner',
      finalWinner: 'A',
      status: BRACKET_STATUS.COMPLETED,
    })
    renderPage(bracket)

    // Podium present — scope to the podium region (names also appear in the tree).
    const podium = screen.getByRole('region', { name: 'podium' })
    expect(within(podium).getByText('Campeón')).toBeInTheDocument()
    expect(within(podium).getByText('Champ')).toBeInTheDocument()
    expect(within(podium).getByText('Subcampeón')).toBeInTheDocument()
    expect(within(podium).getByText('Runner')).toBeInTheDocument()

    // No 3rd-place label in the podium (third place absent).
    expect(within(podium).queryByText('3er Puesto')).not.toBeInTheDocument()

    // The compact tree is still on the same screen (match ids rendered).
    expect(screen.getByText('R2-M1')).toBeInTheDocument()
  })

  it('renders champion, runner-up and third place when COMPLETED with third place', () => {
    const bracket = bracket4({
      finalA: 'Champ',
      finalB: 'Runner',
      finalWinner: 'A',
      status: BRACKET_STATUS.COMPLETED,
      thirdPlace: { a: 'Third', b: 'Fourth', winner: 'A' },
    })
    renderPage(bracket)

    const podium = screen.getByRole('region', { name: 'podium' })
    expect(within(podium).getByText('Campeón')).toBeInTheDocument()
    expect(within(podium).getByText('Champ')).toBeInTheDocument()
    expect(within(podium).getByText('Subcampeón')).toBeInTheDocument()
    expect(within(podium).getByText('Runner')).toBeInTheDocument()
    expect(within(podium).getByText('3er Puesto')).toBeInTheDocument()
    expect(within(podium).getByText('Third')).toBeInTheDocument()
  })

  it('does not crash and shows waiting state when bracket is null (no throw)', () => {
    expect(() => renderPage(null)).not.toThrow()
    expect(screen.getByText('Esperando bracket...')).toBeInTheDocument()
  })
})
