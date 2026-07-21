/**
 * ClubSessionHistoryPanel — admin-facing session history table + actions.
 *
 * Spec — club-session-history "Admin UI — History Tab":
 *   - Table columns: Cancha, Duración, Costo, Fecha.
 *   - Rows sorted by timestamp descending.
 *   - Empty placeholder: "No hay sesiones registradas".
 *   - Disabled when club is not configured: "Club no configurado".
 *   - "Limpiar historial" → ConfirmDialog → emits clear via the hook.
 *   - "Exportar CSV" → triggers GET /api/club/sessions/export download.
 *   - Surfaces 401/403/network errors with clear i18n messages.
 *
 * The socket bridge (`useClubSessionHistory`) is INJECTED via props so
 * the panel stays testable without socket wiring and stays focused on
 * presentation. All user-visible strings come from useI18n.
 */

import { useState, useCallback } from 'react'
import type { SessionRecord } from '@shared/types'
import { Button } from '@/components/atoms/Button'
import { Body } from '@/components/atoms/Typography'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { useI18n } from '@/i18n'
import type { UseClubSessionHistoryReturn } from '@/hooks/useClubSessionHistory'

export type ExportOutcome =
  | { ok: true }
  | { ok: false; status: number | 'network' | 'unknown' }

export interface ClubSessionHistoryPanelProps {
  /** Sessions + clear-flow actions, injected for testability. */
  history: UseClubSessionHistoryReturn
  /** False when no club config exists; the panel renders the disabled state. */
  clubConfigured: boolean
  /**
   * Optional CSV export implementation. Default uses fetch + blob download.
   * Tests inject a stub; the result drives 401/403/network error display.
   */
  onExportCSV?: () => Promise<ExportOutcome>
}

const SORTED_DESC = (a: SessionRecord, b: SessionRecord) =>
  b.timestamp.localeCompare(a.timestamp)

export function ClubSessionHistoryPanel({
  history,
  clubConfigured,
  onExportCSV,
}: ClubSessionHistoryPanelProps) {
  const { i18nText } = useI18n()
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setExportError(null)
    setExporting(true)
    try {
      const outcome = onExportCSV ? await onExportCSV() : await defaultExportCSV()
      if (!outcome.ok) {
        setExportError(exportErrorMessage(outcome.status, i18nText))
      }
    } catch {
      setExportError(i18nText('historyErrorNetwork'))
    } finally {
      setExporting(false)
    }
  }, [onExportCSV, i18nText])

  // Disabled: club not configured — no table, no actions, just the message.
  if (!clubConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Body className="text-text/50 text-center">{i18nText('historyDisabled')}</Body>
      </div>
    )
  }

  const sorted = [...history.sessions].sort(SORTED_DESC)
  const isEmpty = sorted.length === 0

  const clearErrorMessage = mapClearError(history.clearError, i18nText)
  const showError = clearErrorMessage ?? exportError

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || isEmpty}
          loading={exporting}
        >
          {i18nText('historyExportBtn')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => history.clearHistory()}
          disabled={isEmpty || history.pendingClearConfirm}
        >
          {i18nText('historyClearBtn')}
        </Button>
      </div>

      {/* Error banner (clear error + export error) */}
      {showError && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {showError}
        </div>
      )}

      {/* Table or empty placeholder */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Body className="text-text/50 text-center">{i18nText('historyEmpty')}</Body>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table role="table" className="min-w-full text-sm">
            <thead>
              <tr>
                <th role="columnheader" scope="col" className="px-2 py-1 text-left font-medium">
                  {i18nText('historyColCourt')}
                </th>
                <th role="columnheader" scope="col" className="px-2 py-1 text-left font-medium">
                  {i18nText('historyColDuration')}
                </th>
                <th role="columnheader" scope="col" className="px-2 py-1 text-left font-medium">
                  {i18nText('historyColCost')}
                </th>
                <th role="columnheader" scope="col" className="px-2 py-1 text-left font-medium">
                  {i18nText('historyColDate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.sessionId}>
                  <td role="cell" className="px-2 py-1">{s.courtName}</td>
                  <td role="cell" className="px-2 py-1">
                    {i18nText('historyDurationMinutes', { minutes: s.elapsedMinutes })}
                  </td>
                  <td role="cell" className="px-2 py-1">
                    {i18nText('historyCost', { cost: s.cost, currency: s.currency })}
                  </td>
                  <td role="cell" className="px-2 py-1">{formatDate(s.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clear confirmation — shown while the server holds pending-clear. */}
      <ConfirmDialog
        isOpen={history.pendingClearConfirm}
        title={i18nText('historyClearConfirmTitle')}
        message={i18nText('historyClearConfirmMessage')}
        severity="error"
        confirmLabel={i18nText('historyClearConfirmAction')}
        cancelLabel={i18nText('historyClearCancel')}
        onConfirm={() => history.confirmClearHistory()}
        onCancel={() => history.cancelClearHistory()}
      />
    </div>
  )
}

/** Map a clear-error code (from the hook) to a localized message. */
function mapClearError(
  code: string | null,
  i18nText: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (!code) return null
  if (code === 'CLEAR_TIMEOUT') return i18nText('historyErrorClearTimeout')
  if (code === 'NO_CONNECTION') return i18nText('historyErrorNetwork')
  return null
}

/** Map an export failure status to a localized message. */
function exportErrorMessage(
  status: number | 'network' | 'unknown',
  i18nText: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (status === 401) return i18nText('historyError401')
  if (status === 403) return i18nText('historyError403')
  if (status === 'network') return i18nText('historyErrorNetwork')
  return i18nText('historyErrorGeneric')
}

/** Format an ISO timestamp as a localized date string. */
function formatDate(iso: string): string {
  // Keep the formatting deterministic for tests by using a fixed format.
  // The user sees locale-specific output once browsers format Date.toLocaleString.
  try {
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return d.toLocaleString()
  } catch {
    // fall through
  }
  return iso
}

/**
 * Default export implementation — fetches the CSV and triggers a download.
 * Mirrors the existing export-button pattern.
 */
async function defaultExportCSV(): Promise<ExportOutcome> {
  let res: Response
  try {
    res = await fetch('/api/club/sessions/export', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'text/csv' },
    })
  } catch {
    return { ok: false, status: 'network' }
  }

  if (!res.ok) {
    return { ok: false, status: res.status }
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rallyos-sessions.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { ok: true }
}