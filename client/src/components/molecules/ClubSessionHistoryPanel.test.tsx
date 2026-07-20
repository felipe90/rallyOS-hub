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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
        historyColDuration: 'Duración',
        historyColCost: 'Costo',
        historyColDate: 'Fecha',
        historyModeFree: 'Libre',
        historyModeMatch: 'Match',
        historyClearBtn: 'Limpiar historial',
        historyExportBtn: 'Exportar CSV',
        historyClearConfirmTitle: 'Limpiar historial',
        historyClearConfirmMessage: '¿Eliminar todos los registros?',
        historyClearConfirmAction: 'Limpiar',
        historyClearCancel: 'Cancelar',
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
  it('renders a table with the 5 spec columns (inSpanish)', () => {
    render(
      <ClubSessionHistoryPanel
        history={makeHistoryStub({ sessions: [record()] })}
        clubConfigured={true}
      />,
    )
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Cancha' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Modalidad' })).toBeInTheDocument()
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
    expect(cells.find((c) => c.textContent === 'NEW')).toBeDefined()
    const newIdx = cells.findIndex((c) => c.textContent === 'NEW')
    const midIdx = cells.findIndex((c) => c.textContent === 'MID')
    const oldIdx = cells.findIndex((c) => c.textContent === 'OLD')
    expect(newIdx).toBeLessThan(midIdx)
    expect(midIdx).toBeLessThan(oldIdx)
  })

  it('translates match/free mode values via i18n', () => {
    const sessions = [
      record({ sessionId: 'm', mode: 'match' }),
      record({ sessionId: 'f', mode: 'free', cost: 0 }),
    ]
    render(
      <ClubSessionHistoryPanel history={makeHistoryStub({ sessions })} clubConfigured={true} />,
    )
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.getByText('Libre')).toBeInTheDocument()
  })

  it('renders "Gratis" for free-mode cost and "{{cost}} {{currency}}" for paid sessions', () => {
    const sessions = [
      record({ sessionId: 'm', mode: 'match', cost: 500, currency: 'ARS' }),
      record({ sessionId: 'f', mode: 'free', cost: 0, currency: 'ARS' }),
    ]
    render(
      <ClubSessionHistoryPanel history={makeHistoryStub({ sessions })} clubConfigured={true} />,
    )
    expect(screen.getByText('500 ARS')).toBeInTheDocument()
    expect(screen.getByText('Gratis')).toBeInTheDocument()
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