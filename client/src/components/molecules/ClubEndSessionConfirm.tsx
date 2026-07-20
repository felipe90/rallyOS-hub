/**
 * ClubEndSessionConfirm — end-session confirmation modal.
 *
 * Spec task 4.4 + spec scenario 5 (Player ends session).
 * Spec contract: show elapsed time; "Sí, terminar" emits confirm=true;
 * "Cancelar" emits confirm=false OR cancelEndSession locally.
 *
 * The parent (ClubPlayPage) wires:
 *   - onConfirm → useClubPlay.endSession(true) (emits CLUB_END_SESSION with
 *     confirm=true → server transitions court to FINISHED).
 *   - onCancel  → useClubPlay.cancelEndSession() (local-only state reset
 *     per spec scenario 6; no server round-trip).
 */
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import { formatElapsed } from '@/hooks/useClubTimer'

export interface ClubEndSessionConfirmProps {
  /** Whether the modal is visible. */
  isOpen: boolean
  /** Server-authoritative elapsed seconds, formatted to MM:SS / HH:MM:SS. */
  elapsedSeconds: number
  /** Emits when "Sí, terminar" is pressed. */
  onConfirm: () => void
  /** Emits when "Cancelar" is pressed (or backdrop clicked). */
  onCancel: () => void
}

export function ClubEndSessionConfirm({
  isOpen,
  elapsedSeconds,
  onConfirm,
  onCancel,
}: ClubEndSessionConfirmProps) {
  const { i18nText } = useI18n()
  if (!isOpen) return null

  const formatted = formatElapsed(elapsedSeconds)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="club-end-session-confirm"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="club-end-session-title"
        className="card relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm flex flex-col gap-4"
      >
        <Typography
          variant="title"
          id="club-end-session-title"
          className="text-center"
        >
          {i18nText('clubPlayEndSessionTitle')}
        </Typography>

        <div className="flex flex-col items-center gap-1">
          <Typography variant="label" className="text-muted-foreground normal-case">
            {i18nText('clubPlayElapsedTimeLabel')}
          </Typography>
          <Typography variant="headline" className="font-mono tabular-nums">
            {formatted}
          </Typography>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {i18nText('clubPlayCancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} className="flex-1">
            {i18nText('clubPlayConfirmEnd')}
          </Button>
        </div>
      </div>
    </div>
  )
}