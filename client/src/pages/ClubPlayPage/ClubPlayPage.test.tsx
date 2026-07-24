/**
 * ClubPlayPage — integration tests for the PR 4 refactored flow.
 *
 * Spec task 4.6 + 4.8 — mode transitions end-to-end:
 *   JOIN → loading → session-config (Free/Match) → free OR match →
 *   post-match modal (Reset/New Match/Free/End Session) → end-session
 *   confirm → finished (sessionEnded) → "Volver al inicio".
 *
 * Approval-test rewrite: the page's behavior changes per spec. The new
 * assertions describe the refactored spec-compliant behavior. RED →
 * GREEN after the refactor.
 *
 * Strategy: mock useClubPlay + socket + i18n + child molecules. Assert
 * which child screen is mounted for each (sessionMode, matchState.status,
 * pendingEndSessionConfirm, sessionEnded) combination, and assert the
 * page wires child component callbacks to the right useClubPlay emitters.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// ─── i18n mock ────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        clubPlayLoading: 'Conectando...',
        clubPlayReconnecting: 'Reconectando...',
        clubPlayFinished: 'Sesión finalizada',
        clubPlayGoHome: 'Volver al inicio',
        clubPlayEndSession: 'Finalizar sesión',
        clubPlaySessionEnded: 'Sesión finalizada',
        clubPlayPostMatchTitle: 'Partido finalizado',
        clubPlayPostMatchReset: '🔄 Reset',
        clubPlayPostMatchNew: '🆕 Nuevo partido',
        clubPlayPostMatchFree: '🎯 Modo Libre',
        clubPlayNameA: 'Jugador 1',
        clubPlayNameB: 'Jugador 2',
        clubPlayScoreA: 'Jugador 1',
        clubPlayScoreB: 'Jugador 2',
        clubPlayBackToFree: '🎯 Volver a modo libre',
        clubPlayEndSessionBtn: '⏹ Terminar sesión',
        clubPlayRefereeReplaced: 'Alguien más tomó el control',
        clubPlayElapsedTime: 'Tiempo: {{minutes}} min',
        clubPlayTotalCost: 'Total: {{cost}} {{currency}}',
        scoreboardInvalidCourtId: 'ID de cancha inválido',
        scoreboardLoading: 'Cargando partido...',
        scoreboardHistory: 'Historial',
        scoreboardBack: 'Volver',
        commonPlayerA: 'Player A',
        commonPlayerB: 'Player B',
        connectionConnected: 'Conectado',
        connectionConnecting: 'Conectando',
        connectionNoConnection: 'Sin Conexión',
        connectionDisconnected: 'Desconectado',
        toastConnectionError: 'Error de conexión',
      }
      if (params && map[key]) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
          map[key],
        )
      }
      return map[key] || key
    },
  }),
}))

// ─── socket context mock ─────────────────────────────────────────────
const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, onAny: vi.fn(), offAny: vi.fn() }
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(() => ({ socket: mockSocket, connected: true })),
}))

// ─── useClubPlay hook mock ────────────────────────────────────────────
const mockUseClubPlay = vi.fn()
vi.mock('@/hooks/useClubPlay', () => ({ useClubPlay: () => mockUseClubPlay() }))

// ─── react-router-dom mock (keep useParams real for /:courtId) ───────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── child component mocks — render div stubs exposing callbacks ─────
vi.mock('@/components/organisms/ScoreboardMain', () => ({
  ScoreboardMain: ({ onScorePoint }: { onScorePoint?: (p: 'A' | 'B') => void }) => (
    <div data-testid="scoreboard-main">
      <button onClick={() => onScorePoint?.('A')} data-testid="mock-score-a">Score A</button>
    </div>
  ),
}))
vi.mock('@/components/molecules/PlayerNamePrompt/PlayerNamePrompt', () => ({
  PlayerNamePrompt: () => <div data-testid="player-name-prompt">prompt</div>,
}))
vi.mock('@/components/molecules/ClubSessionConfig', () => ({
  ClubSessionConfig: ({ onSelectFree, onSelectMatch }: { onSelectFree: (name: string, phone: string) => void; onSelectMatch: (name: string, phone: string) => void }) => (
    <div data-testid="club-session-config">
      <button onClick={() => onSelectFree('Test', '1155550000')} data-testid="mock-session-free">Mock-Free</button>
      <button onClick={() => onSelectMatch('Test', '1155550000')} data-testid="mock-session-match">Mock-Match</button>
    </div>
  ),
}))
vi.mock('@/components/molecules/ClubMatchConfig', () => ({
  ClubMatchConfig: ({ onSubmit, onCancel }: { onSubmit: (p: unknown) => void; onCancel?: () => void }) => (
    <div data-testid="club-match-config">
      <button onClick={() => onSubmit({ courtId: 'court-1', playerNameA: 'A', playerNameB: 'B', matchConfig: {} })} data-testid="mock-match-submit">Submit</button>
      <button onClick={() => onCancel?.()} data-testid="mock-match-cancel">Cancel</button>
    </div>
  ),
}))
vi.mock('@/components/molecules/ClubFreePlay', () => ({
  ClubFreePlay: ({ onPlayMatch, onEndSession }: { onPlayMatch: () => void; onEndSession: () => void }) => (
    <div data-testid="club-free-play">
      <button onClick={onPlayMatch} data-testid="mock-free-play-match">Play match</button>
      <button onClick={onEndSession} data-testid="mock-free-end">End session</button>
    </div>
  ),
}))
vi.mock('@/components/molecules/ClubEndSessionConfirm', () => ({
  ClubEndSessionConfirm: ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="club-end-session-confirm">
      <button onClick={onConfirm} data-testid="mock-confirm-yes">Sí</button>
      <button onClick={onCancel} data-testid="mock-confirm-no">No</button>
    </div>
  ),
}))
vi.mock('@/components/atoms/ConnectionStatus', () => ({
  ConnectionStatus: () => <span>ConnectionStatus</span>,
}))
vi.mock('@/components/atoms/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))
vi.mock('@/components/atoms/Typography', () => ({
  Typography: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
vi.mock('@/components/organisms/HistoryDrawer', () => ({
  HistoryDrawer: () => <div data-testid="history-drawer">History</div>,
}))
vi.mock('@/hooks/useOrientation', () => ({
  useOrientation: () => ({ isLandscape: false, toggle: vi.fn() }),
}))

import { ClubPlayPage } from './ClubPlayPage'

function makeHookState(overrides: Record<string, unknown> = {}) {
  return {
    matchState: null,
    loading: true,
    error: null,
    finished: false,
    reconnecting: false,
    refereeReplaced: false,
    sessionEnded: null,
    sessionMode: null,
    elapsedSeconds: 0,
    pendingEndSessionConfirm: false,
    scorePoint: vi.fn(),
    subtractPoint: vi.fn(),
    undoLast: vi.fn(),
    swapSides: vi.fn(),
    startMatch: vi.fn(),
    endSession: vi.fn(),
    startFreePlay: vi.fn(),
    resetMatch: vi.fn(),
    newMatch: vi.fn(),
    cancelEndSession: vi.fn(),
    encryptionKey: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/club/play/court-1']}>
      <Routes>
        <Route path="/club/play/:courtId" element={<ClubPlayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeWaitingMatch(overrides: Record<string, unknown> = {}) {
  return {
    courtId: 'court-1',
    courtName: 'Cancha 1',
    status: 'WAITING',
    config: { sport: 'tableTennis', bestOf: 1, pointsPerSet: 15, minDifference: 2 },
    score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' as const },
    setHistory: [],
    history: [],
    undoAvailable: false,
    playerNames: { a: 'Jugador 1', b: 'Jugador 2' },
    sport: 'tableTennis',
    winner: null,
    swappedSides: false,
    midSetSwapped: false,
    ...overrides,
  }
}

function makeLiveMatch(overrides: Record<string, unknown> = {}) {
  return makeWaitingMatch({ status: 'LIVE', ...overrides })
}

function makeFinishedMatch(overrides: Record<string, unknown> = {}) {
  return makeWaitingMatch({ status: 'FINISHED', setHistory: [{ a: 11, b: 5 }], winner: 'A' as const, ...overrides })
}

describe('ClubPlayPage — PR 4 refactored flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseClubPlay.mockReturnValue(makeHookState())
  })

  // ── initial connection states (existing wiring, preserved) ───────────
  it('renders loading state while connecting', () => {
    mockUseClubPlay.mockReturnValue(makeHookState({ loading: true, matchState: null }))
    renderPage()
    expect(screen.getByText('Conectando...')).toBeInTheDocument()
  })

  it('renders reconnecting state when reconnectAttempted', () => {
    mockUseClubPlay.mockReturnValue(makeHookState({ loading: false, reconnecting: true, matchState: null }))
    renderPage()
    expect(screen.getByText('Reconectando...')).toBeInTheDocument()
  })

  it('renders invalid court view when courtId is missing', () => {
    render(
      <MemoryRouter initialEntries={['/club/play/']}>
        <Routes>
          <Route path="/club/play" element={<ClubPlayPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('ID de cancha inválido')).toBeInTheDocument()
  })

  it('renders error view on connection error', () => {
    mockUseClubPlay.mockReturnValue(makeHookState({ loading: false, error: 'CONNECTION_ERROR', matchState: null }))
    renderPage()
    expect(screen.getByText('Error de conexión')).toBeInTheDocument()
  })

  // ── task 4.6: WAITING + no sessionMode → session-config screen ─────
  it('renders ClubSessionConfig when match is WAITING and sessionMode is null', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: null,
      }),
    )
    renderPage()
    expect(screen.getByTestId('club-session-config')).toBeInTheDocument()
  })

  it('session-config onSelectFree calls startFreePlay', () => {
    const startFreePlay = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: null,
        startFreePlay,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-session-free'))
    expect(startFreePlay).toHaveBeenCalledTimes(1)
  })

  it('session-config onSelectMatch opens ClubMatchConfig screen', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: null,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-session-match'))
    expect(screen.getByTestId('club-match-config')).toBeInTheDocument()
  })

  // ── task 4.6: ClubMatchConfig submit calls newMatch with payload ──
  it('ClubMatchConfig onSubmit calls newMatch with the emitted payload', () => {
    const newMatch = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: null,
        newMatch,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-session-match'))
    fireEvent.click(screen.getByTestId('mock-match-submit'))
    expect(newMatch).toHaveBeenCalledTimes(1)
    // useClubPlay.newMatch signature is (nameA, nameB, playerName?, phone?, matchConfig?)
    // forwarded by handleMatchConfigSubmit with playerName/phone from the
    // ClubSessionConfig flow.
    const [nameA, nameB, pName, pPhone, matchConfig] = newMatch.mock.calls[0]
    expect(nameA).toBe('A')
    expect(nameB).toBe('B')
    // playerName/phone come from the ClubSessionConfig mock ('Test', '1155550000')
    expect(pName).toBe('Test')
    expect(pPhone).toBe('1155550000')
    expect(matchConfig).toEqual({})
  })

  it('ClubMatchConfig onCancel returns to the prior screen', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: null,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-session-match'))
    expect(screen.getByTestId('club-match-config')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('mock-match-cancel'))
    expect(screen.queryByTestId('club-match-config')).not.toBeInTheDocument()
    expect(screen.getByTestId('club-session-config')).toBeInTheDocument()
  })

  // ── task 4.6: sessionMode='free' → ClubFreePlay screen ───────────
  it('renders ClubFreePlay when sessionMode is free', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: 'free',
        elapsedSeconds: 45,
      }),
    )
    renderPage()
    expect(screen.getByTestId('club-free-play')).toBeInTheDocument()
  })

  it('ClubFreePlay onPlayMatch opens ClubMatchConfig', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: 'free',
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-free-play-match'))
    expect(screen.getByTestId('club-match-config')).toBeInTheDocument()
  })

  it('ClubFreePlay onEndSession calls endSession (no confirm — arms modal)', () => {
    const endSession = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeWaitingMatch(),
        sessionMode: 'free',
        endSession,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-free-end'))
    expect(endSession).toHaveBeenCalledTimes(1)
    // Spec: arms confirmation modal — no `true` confirm arg.
    expect(endSession.mock.calls[0][0]).not.toBe(true)
  })

  // ── task 4.6: sessionMode='match' + LIVE → ScoreboardMain ─────────
  it('renders ScoreboardMain when sessionMode is match and match is LIVE', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeLiveMatch(),
        sessionMode: 'match',
      }),
    )
    renderPage()
    expect(screen.getByTestId('scoreboard-main')).toBeInTheDocument()
  })

  it('shows "Volver a modo libre" button during LIVE match and calls startFreePlay on click', () => {
    const mockStartFreePlay = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeLiveMatch(),
        sessionMode: 'match',
        startFreePlay: mockStartFreePlay,
      }),
    )
    renderPage()
    const btn = screen.getByText('🎯 Volver a modo libre')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(mockStartFreePlay).toHaveBeenCalledTimes(1)
  })

  // ── task 4.6: match FINISHED in club mode → post-match modal ─────
  it('renders post-match modal when match FINISHED in club mode (sessionMode=match)', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        finished: true,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
      }),
    )
    renderPage()
    expect(screen.getByText('Partido finalizado')).toBeInTheDocument()
    expect(screen.getByText('🔄 Reset')).toBeInTheDocument()
    expect(screen.getByText('🆕 Nuevo partido')).toBeInTheDocument()
    expect(screen.getByText('🎯 Modo Libre')).toBeInTheDocument()
    expect(screen.getByText(/Finalizar sesión|⏹ Terminar sesión/)).toBeInTheDocument()
  })

  it('post-match Reset calls resetMatch', () => {
    const resetMatch = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        finished: true,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
        resetMatch,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByText('🔄 Reset'))
    expect(resetMatch).toHaveBeenCalledTimes(1)
  })

  it('post-match "Nuevo partido" opens ClubMatchConfig', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        finished: true,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
      }),
    )
    renderPage()
    fireEvent.click(screen.getByText('🆕 Nuevo partido'))
    expect(screen.getByTestId('club-match-config')).toBeInTheDocument()
  })

  it('post-match "Ir a Modo Libre" calls startFreePlay', () => {
    const startFreePlay = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        finished: true,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
        startFreePlay,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByText('🎯 Modo Libre'))
    expect(startFreePlay).toHaveBeenCalledTimes(1)
  })

  it('post-match end-session button calls endSession (arms modal)', () => {
    const endSession = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        finished: true,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
        endSession,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByText(/Finalizar sesión|⏹ Terminar sesión/))
    expect(endSession).toHaveBeenCalledTimes(1)
    expect(endSession.mock.calls[0][0]).not.toBe(true)
  })

  // ── task 4.6: end-session confirmation modal ───────────────────────
  it('renders ClubEndSessionConfirm overlay when pendingEndSessionConfirm is true', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
        pendingEndSessionConfirm: true,
        elapsedSeconds: 600,
      }),
    )
    renderPage()
    expect(screen.getByTestId('club-end-session-confirm')).toBeInTheDocument()
  })

  it('ClubEndSessionConfirm onConfirm calls endSession(true)', () => {
    const endSession = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
        pendingEndSessionConfirm: true,
        endSession,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-confirm-yes'))
    expect(endSession).toHaveBeenCalledWith(true)
  })

  it('ClubEndSessionConfirm onCancel calls cancelEndSession', () => {
    const cancelEndSession = vi.fn()
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeFinishedMatch(),
        sessionMode: 'match',
        pendingEndSessionConfirm: true,
        cancelEndSession,
      }),
    )
    renderPage()
    fireEvent.click(screen.getByTestId('mock-confirm-no'))
    expect(cancelEndSession).toHaveBeenCalledTimes(1)
  })

  // ── task 4.6: sessionEnded → finished view ─────────────────────────
  it('renders FinishedView with Volver al inicio when sessionEnded is present', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeFinishedMatch(),
        sessionEnded: { elapsedMinutes: 30, cost: 100, currency: 'ARS', reason: 'player' },
      }),
    )
    renderPage()
    expect(screen.getByText('Sesión finalizada')).toBeInTheDocument()
    expect(screen.getByText('Volver al inicio')).toBeInTheDocument()
  })

  it('Volver al inicio navigates to AUTH route', () => {
    mockUseClubPlay.mockReturnValue(
      makeHookState({
        loading: false,
        matchState: makeFinishedMatch(),
        sessionEnded: { elapsedMinutes: 30, cost: 100, currency: 'ARS', reason: 'player' },
      }),
    )
    renderPage()
    fireEvent.click(screen.getByText('Volver al inicio'))
    expect(mockNavigate).toHaveBeenCalled()
  })
})