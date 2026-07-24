/**
 * ClubSessionHistoryPanel — strict TDD tests.
 *
 * Spec scenarios covered (club-session-history spec):
 *   - Empty history shows placeholder        → historyEmpty
 *   - History table displays session records → table rows sorted desc by timestamp
 *   - Clear with confirmation flow           → Limpiar button → ConfirmDialog → onConfirm
 *   - Export button                          → triggers onExportCSV
 *   - Disabled state                         → club not configured
 *   - 401/403 error handling                 → clear messages from i18n
 *
 * Hook (useClubSessionHistory) is injected — already tested in 5.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ClubSessionHistoryPanel } from './ClubSessionHistoryPanel'
import type { UseClubSessionHistoryReturn } from '@/hooks/useClubSessionHistory'
import type { SessionRecord } from '@shared/types'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        clubAdminTabCourts: 'Canchas',
        clubAdminTabHistory: 'Historial',
        historyColCourt: 'Cancha',
        historyColMode: 'Modalidad',
        historyColPlayer: 'Jugador',
        historyColDuration: 'Duración',
        historyColCost: 'Costo',
        historyColDate: 'Fecha',
        historyRevealPhoneBtn: 'Ver teléfono',
        historyRevealPhoneLabel: 'Teléfono:',
        historyModeFree: 'Libre',
        historyModeMatch: 'Match',
        historyClearBtn: 'Limpiar historial',
        historyExportBtn: 'Exportar CSV',
        historyClearConfirmTitle: 'Limpiar historial',
        historyClearConfirmMessage: '¿Eliminar todos los registros?',
        historyClearConfirmAction: 'Limpiar',
        historyClearCancel: 'Cancelar',
        commonClose: 'Cerrar',
        historyEmpty: 'No hay sesiones registradas',
        historyDisabled: 'Club no configurado',
        historyDurationMinutes: '{{minutes}} min',
        historyCost: '{{cost}} {{currency}}',
        historyFreeCost: 'Gratis',
        historyError401: 'Tu sesión expiró.',
        historyError403: 'No tenés permisos de administrador.',
        historyErrorNetwork: 'Error de red.',
        historyErrorClearTimeout: 'La confirmación expiró.',
        historyErrorGeneric: 'No se pudo completar la acción.',
      }
      let s = map[key] ?? key
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          s = s.replace(`{{${k}}}`, String(v))
        }
      }
      return s
    },
  }),
}))

function makeHistoryStub(overrides: Partial<UseClubSessionHistoryReturn> = {}): UseClubSessionHistoryReturn {
  return {
    sessions: [],
    clearHistory: vi.fn(),
    confirmClearHistory: vi.fn(),
    cancelClearHistory: vi.fn(),
    pendingClearConfirm: false,
    clearError: null,
    revealedPhone: null,
    revealPhone: vi.fn(),
    clearRevealedPhone: vi.fn(),
    ...overrides,
  }
}

const record = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  courtName: 'Cancha 1',
  elapsedSeconds: 600,
  elapsedMinutes: 10,
  mode: 'match',
  cost: 500,
  currency: 'ARS',
  timestamp: '2026-07-20T10:00:00.000Z',
  sessionId: 's-' + Math.random().toString(36).slice(2),
  ...over,
})

describe('ClubSessionHistoryPanel — disabled state', () => {
  it('renders the disabled placeholder when club is not configured', () => {
    render(<ClubSessionHistoryPanel history={makeHistoryStub()} clubConfigured={false} />)
    expect(screen.getByText('Club no configurado')).toBeInTheDocument()
  })

  it('does not render the table or the clear/export buttons when disabled', () => {
    render(<ClubSessionHistoryPanel history={makeHistoryStub()} clubConfigured={false} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Limpiar historial/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument()
  })
})

describe('ClubSessionHistoryPanel — empty state', () => {
  it('renders the empty placeholder when there are no sessions', () => {
    render(<ClubSessionHistoryPanel history={makeHistoryStub()} clubConfigured={true} />)
    expect(screen.getByText('No hay sesiones registradas')).toBeInTheDocument()
  })

  it('shows the clear and export buttons even when empty (admin still can act)', () => {
    render(<ClubSessionHistoryPanel history={makeHistoryStub()} clubConfigured={true} />)
    expect(screen.getByRole('button', { name: /Limpiar historial/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeInTheDocument()
  })
})

describe('ClubSessionHistoryPanel — table rendering', () => {
  it('renders a table with the 4 spec columns (inSpanish)', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
      />,
    )
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Cancha' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Duración' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Costo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toBeInTheDocument()
  })

  it('renders one row per session record', () => {
    const sessions = [
      record({ sessionId: 'a', courtName: 'Cancha 1' }),
      record({ sessionId: 'b', courtName: 'Cancha 2' }),
      record({ sessionId: 'c', courtName: 'Cancha 3' }),
    ]
    render(
      <ClubSessionHistoryPanel history={makeHistoryStub({ sessions })} clubConfigured={true} />,
    )
    expect(screen.getAllByRole('row').length).toBe(4) // 1 header + 3 data
    expect(screen.getByRole('cell', { name: 'Cancha 2' })).toBeInTheDocument()
  })

  it('sorts rows by timestamp descending (most recent first)', () => {
    const sessions = [
      record({ sessionId: 'old', courtName: 'OLD', timestamp: '2026-07-01T10:00:00.000Z' }),
      record({ sessionId: 'new', courtName: 'NEW', timestamp: '2026-07-20T10:00:00.000Z' }),
      record({ sessionId: 'mid', courtName: 'MID', timestamp: '2026-07-10T10:00:00.000Z' }),
    ]
    render(
      <ClubSessionHistoryPanel history={makeHistoryStub({ sessions })} clubConfigured={true} />,
    )
    const cells = screen.getAllByRole('cell')
    // First data row should be NEW (most recent), then MID, then OLD
    expect(screen.getByRole('cell', { name: 'NEW' })).toBeInTheDocument()
    const newIdx = cells.findIndex((c) => c.textContent === 'NEW')
    const midIdx = cells.findIndex((c) => c.textContent === 'MID')
    const oldIdx = cells.findIndex((c) => c.textContent === 'OLD')
    expect(newIdx).toBeLessThan(midIdx)
    expect(midIdx).toBeLessThan(oldIdx)
  })

  it('renders cost for both match and free sessions (same cost formula)', () => {
    const sessions = [
      record({ sessionId: 'm', mode: 'match', cost: 500, currency: 'ARS' }),
      record({ sessionId: 'f', mode: 'free', cost: 250, currency: 'ARS' }),
    ]
    render(
      <ClubSessionHistoryPanel history={makeHistoryStub({ sessions })} clubConfigured={true} />,
    )
    expect(screen.getByText('500 ARS')).toBeInTheDocument()
    expect(screen.getByText('250 ARS')).toBeInTheDocument()
  })
})

describe('ClubSessionHistoryPanel — clear confirmation flow', () => {
  it('clicking "Limpiar historial" calls history.clearHistory()', () => {
    const history = makeHistoryStub({ sessions: [record()] })
    render(<ClubSessionHistoryPanel history={history} clubConfigured={true} />)
    fireEvent.click(screen.getByRole('button', { name: /Limpiar historial/ }))
    expect(history.clearHistory).toHaveBeenCalledTimes(1)
  })

  it('renders a confirmation dialog when pendingClearConfirm is true', () => {
    const history = makeHistoryStub({ pendingClearConfirm: true })
    render(<ClubSessionHistoryPanel history={history} clubConfigured={true} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('¿Eliminar todos los registros?')).toBeInTheDocument()
  })

  it('confirming the dialog calls history.confirmClearHistory()', () => {
    const history = makeHistoryStub({ pendingClearConfirm: true })
    render(<ClubSessionHistoryPanel history={history} clubConfigured={true} />)
    fireEvent.click(screen.getByRole('button', { name: /^Limpiar$/ }))
    expect(history.confirmClearHistory).toHaveBeenCalledTimes(1)
  })

  it('cancelling the dialog calls history.cancelClearHistory()', () => {
    const history = makeHistoryStub({ pendingClearConfirm: true })
    render(<ClubSessionHistoryPanel history={history} clubConfigured={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(history.cancelClearHistory).toHaveBeenCalledTimes(1)
  })
})

describe('ClubSessionHistoryPanel — CSV export', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the injected onExportCSV handler when "Exportar CSV" is clicked', async () => {
    const onExportCSV = vi.fn().mockResolvedValue({ ok: true } as any)
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
        onExportCSV={onExportCSV as any}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await waitFor(() => expect(onExportCSV).toHaveBeenCalledTimes(1))
  })

  it('surfaces the 401 message when export returns ok=false with status=401', async () => {
    const onExportCSV = vi.fn().mockResolvedValue({ ok: false, status: 401 } as any)
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
        onExportCSV={onExportCSV as any}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await waitFor(() => expect(screen.getByText('Tu sesión expiró.')).toBeInTheDocument())
  })

  it('surfaces the 403 message when export returns ok=false with status=403', async () => {
    const onExportCSV = vi.fn().mockResolvedValue({ ok: false, status: 403 } as any)
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
        onExportCSV={onExportCSV as any}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await waitFor(() =>
      expect(screen.getByText('No tenés permisos de administrador.')).toBeInTheDocument(),
    )
  })

  it('surfaces the network error message when export returns status="network"', async () => {
    const onExportCSV = vi.fn().mockResolvedValue({ ok: false, status: 'network' } as any)
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
        onExportCSV={onExportCSV as any}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await waitFor(() => expect(screen.getByText('Error de red.')).toBeInTheDocument())
  })

  it('surfaces the generic error message for unknown failure statuses', async () => {
    const onExportCSV = vi.fn().mockResolvedValue({ ok: false, status: 500 } as any)
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
        onExportCSV={onExportCSV as any}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await waitFor(() =>
      expect(screen.getByText('No se pudo completar la acción.')).toBeInTheDocument(),
    )
  })
})

describe('ClubSessionHistoryPanel — player column (Phase 7 / U4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a "Jugador" column header between "Cancha" and "Duración"', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    const courtIdx = headers.findIndex((h) => h.textContent === 'Cancha')
    const playerIdx = headers.findIndex((h) => h.textContent === 'Jugador')
    const durIdx = headers.findIndex((h) => h.textContent === 'Duración')
    expect(courtIdx).toBeGreaterThanOrEqual(0)
    expect(playerIdx).toBeGreaterThanOrEqual(0)
    expect(durIdx).toBeGreaterThanOrEqual(0)
    expect(playerIdx).toBe(courtIdx + 1)
    expect(durIdx).toBe(playerIdx + 1)
  })

  it('shows playerName in the cell when the record has one', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record({ playerName: 'Carlos' })] })}
        clubConfigured={true}
      />,
    )
    expect(screen.getByRole('cell', { name: 'Carlos' })).toBeInTheDocument()
  })

  it('shows an empty string in the playerName cell when the record lacks playerName', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({
          sessions: [record({ playerName: '' })],
        })}
        clubConfigured={true}
      />,
    )
    const cells = screen.getAllByRole('cell')
    // The second cell after Cancha is the player column; should be empty
    const canchaCell = cells[0]
    const playerCell = cells[1]
    expect(canchaCell.textContent).toBe('Cancha 1')
    expect(playerCell.textContent).toBe('')
  })

  it('renders a "Ver teléfono" button when session.phone exists', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record({ playerName: 'Ana', phone: 'cipher:abc' })] })}
        clubConfigured={true}
      />,
    )
    expect(screen.getByRole('button', { name: 'Ver teléfono' })).toBeInTheDocument()
  })

  it('does NOT render "Ver teléfono" when session.phone is undefined', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({
          sessions: [record({ playerName: 'Ana', phone: undefined as any })],
        })}
        clubConfigured={true}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Ver teléfono' })).not.toBeInTheDocument()
  })

  it('clicking "Ver teléfono" calls onRevealPhone with the sessionId', () => {
    const history = makeHistoryStub({
      sessions: [record({ sessionId: 's-1', playerName: 'Ana', phone: 'cipher:abc' })],
    })
    render(
      <ClubSessionHistoryPanel history={history} clubConfigured={true} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver teléfono' }))
    expect(history.revealPhone).toHaveBeenCalledWith('s-1')
  })

  it('shows a phone modal when revealedPhone matches the session', () => {
    const session = record({ sessionId: 's-1', playerName: 'Ana', phone: 'cipher:abc' })
    const history = makeHistoryStub({
      sessions: [session],
      revealedPhone: { sessionId: 's-1', phone: '555-1234' },
    })
    render(
      <ClubSessionHistoryPanel history={history} clubConfigured={true} />,
    )
    expect(screen.getByText('555-1234')).toBeInTheDocument()
    expect(screen.getByText('Teléfono:')).toBeInTheDocument()
  })

  it('does NOT show a phone modal when revealedPhone is for a different session', () => {
    const session = record({ sessionId: 's-1', playerName: 'Ana', phone: 'cipher:abc' })
    const history = makeHistoryStub({
      sessions: [session],
      revealedPhone: { sessionId: 's-other', phone: '555-9999' },
    })
    render(
      <ClubSessionHistoryPanel history={history} clubConfigured={true} />,
    )
    expect(screen.queryByText('555-9999')).not.toBeInTheDocument()
  })

  it('phone modal auto-dismisses after 10s', () => {
    const session = record({ sessionId: 's-1', playerName: 'Ana', phone: 'cipher:abc' })
    const clearRevealedPhone = vi.fn()
    const history = makeHistoryStub({
      sessions: [session],
      revealedPhone: { sessionId: 's-1', phone: '555-1234' },
      clearRevealedPhone,
    })
    render(
      <ClubSessionHistoryPanel history={history} clubConfigured={true} />,
    )
    expect(screen.getByText('555-1234')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(clearRevealedPhone).toHaveBeenCalledTimes(1)
  })

  it('phone modal has a manual "Cerrar" button that calls onClearRevealedPhone', () => {
    const session = record({ sessionId: 's-1', playerName: 'Ana', phone: 'cipher:abc' })
    const clearRevealedPhone = vi.fn()
    const history = makeHistoryStub({
      sessions: [session],
      revealedPhone: { sessionId: 's-1', phone: '555-1234' },
      clearRevealedPhone,
    })
    render(
      <ClubSessionHistoryPanel history={history} clubConfigured={true} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(clearRevealedPhone).toHaveBeenCalledTimes(1)
  })
})

describe('ClubSessionHistoryPanel — clear error surfacing', () => {
  it('renders the timeout message when history.clearError === "CLEAR_TIMEOUT"', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ clearError: 'CLEAR_TIMEOUT' })}
        clubConfigured={true}
      />,
    )
    expect(screen.getByText('La confirmación expiró.')).toBeInTheDocument()
  })

  it('renders NO_CONNECTION message when history.clearError === "NO_CONNECTION"', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ clearError: 'NO_CONNECTION' })}
        clubConfigured={true}
      />,
    )
    expect(screen.getByText('Error de red.')).toBeInTheDocument()
  })
})