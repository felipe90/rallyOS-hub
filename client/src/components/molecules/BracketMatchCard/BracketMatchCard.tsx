/**
 * BracketMatchCard molecule — renders a single bracket match.
 *
 * Reuses Card/Button/Badge/ConfirmDialog atoms and the `card-light` + `border-l-4`
 * design classes. State-driven rendering:
 *  - PENDING (both empty): two assign placeholders.
 *  - READY both filled: assignable slots + "Ganó A/B" (confirm-gated).
 *  - READY bye (one empty): occupied slot auto-advances; empty slot disabled.
 *  - COMPLETED: shows result + undo (confirm-gated).
 * Court button always allows re-assignment (orphan → "Cancha eliminada").
 */

import { useState } from 'react'
import { MapPin, Undo2, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/atoms/Button'
import { Caption } from '@/components/atoms/Typography'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import type { BracketMatch, BracketSlot, Player } from '@shared/types'

export interface BracketMatchCardProps {
  match: BracketMatch
  /** Canonical name of the live court referenced by `match.courtId`, if any. */
  courtLabel?: string | null
  /** courtId still set but the court was removed from the dashboard list. */
  courtOrphan?: boolean
  /** The court is busy with another match (non-blocking warning). */
  courtOccupied?: boolean
  onAssignSlot: (matchId: string, slot: BracketSlot) => void
  onSetWinner: (matchId: string, winner: Player) => void
  onAssignCourt: (matchId: string) => void
  onUndo: (matchId: string) => void
}

const SLOT: Record<Player | 'A' | 'B', BracketSlot> = { A: 'A', B: 'B' }

export function BracketMatchCard({
  match,
  courtLabel,
  courtOrphan = false,
  courtOccupied = false,
  onAssignSlot,
  onSetWinner,
  onAssignCourt,
  onUndo,
}: BracketMatchCardProps) {
  const { i18nText } = useI18n()
  const [winnerConfirm, setWinnerConfirm] = useState<Player | null>(null)
  const [undoConfirm, setUndoConfirm] = useState(false)

  const completed = match.status === 'COMPLETED'
  const bothEmpty = match.playerA == null && match.playerB == null
  const oneEmpty = (match.playerA == null) !== (match.playerB == null)
  const bye = !completed && oneEmpty

  const placeholder = i18nText('bracketPlaceholder')
  const noCourt = i18nText('bracketNoCourt')
  const orphanLabel = i18nText('bracketCourtOrphan')

  const courtDisplay =
    match.courtId == null ? noCourt : courtOrphan ? orphanLabel : (courtLabel ?? noCourt)

  const winnerName = winnerConfirm ? (winnerConfirm === 'A' ? match.playerA : match.playerB) : null
  const confirmMessage =
    winnerName != null
      ? i18nText('bracketConfirmWinnerMessage', { name: winnerName })
      : i18nText('bracketConfirmUndoMessage')

  /** Status border color — matches court card convention */
  const borderColor = completed
    ? 'border-l-gray-400'
    : bye
      ? 'border-l-amber-500'
      : bothEmpty
        ? 'border-l-blue-500'
        : 'border-l-emerald-500'

  /** Compact status pill — matches court card pill style */
  const statusPill = (label: string, className: string) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${className}`}>
      {label}
    </span>
  )

  const completedPill = statusPill(i18nText('bracketCompleted'), 'bg-gray-500/15 text-gray-500')
  const byePill = statusPill(i18nText('bracketBye'), 'bg-amber-500/15 text-amber-600')

  const renderSlot = (slot: BracketSlot, name: string | null) => {
    const empty = name == null
    const showWin = !completed && !empty
    return (
      <div key={slot} className="flex items-center gap-2">
        <Button
          variant={empty ? 'outline' : 'ghost'}
          size="md"
          className="flex-1 min-w-0"
          onClick={() => onAssignSlot(match.id, slot)}
        >
          <span className="truncate">{empty ? placeholder : name}</span>
        </Button>
        {showWin && (
          <Button
            variant="primary"
            size="sm"
            aria-label={i18nText('bracketWinnerNamed', { name })}
            onClick={() => setWinnerConfirm(slot)}
          >
            {i18nText('bracketWinnerShort')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`card-light flex flex-col gap-2 p-4 border-l-4 ${borderColor} transition-shadow duration-200 cursor-pointer`}>
      <div className="flex items-center gap-2 justify-between">
        <span className="font-heading text-sm text-text/60">{match.id}</span>
        {completed && completedPill}
        {bye && byePill}
      </div>

      <div className="flex flex-col gap-1.5">
        {renderSlot(SLOT.A, match.playerA)}
        <Caption className="text-center text-text-muted">{i18nText('commonVs')}</Caption>
        {renderSlot(SLOT.B, match.playerB)}
      </div>

      {/* Court + undo row */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<MapPin size={14} />}
          onClick={() => onAssignCourt(match.id)}
          className="flex-1"
        >
          {courtDisplay}
        </Button>

        {completed && (
          <Button variant="secondary" size="sm" icon={<Undo2 size={14} />} onClick={() => setUndoConfirm(true)}>
            {i18nText('bracketUndo')}
          </Button>
        )}
      </div>

      {courtOccupied && (
        <div role="alert" className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="text-xs">{i18nText('bracketCourtOccupiedWarn')}</span>
        </div>
      )}

      {/* Winner confirm */}
      <ConfirmDialog
        isOpen={winnerConfirm != null}
        title={i18nText('bracketConfirmWinnerTitle')}
        message={confirmMessage}
        severity="info"
        confirmLabel={i18nText('commonConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={() => {
          // Capture id BEFORE closing so the state-update re-render cannot drop it.
          const w = winnerConfirm
          setWinnerConfirm(null)
          if (w) onSetWinner(match.id, w)
        }}
        onCancel={() => setWinnerConfirm(null)}
      />

      {/* Undo confirm */}
      <ConfirmDialog
        isOpen={undoConfirm}
        title={i18nText('bracketConfirmUndoTitle')}
        message={i18nText('bracketConfirmUndoMessage')}
        severity="warning"
        confirmLabel={i18nText('commonConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={() => {
          setUndoConfirm(false)
          onUndo(match.id)
        }}
        onCancel={() => setUndoConfirm(false)}
      />
    </div>
  )
}