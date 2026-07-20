import { useI18n } from '@/i18n'
import { Typography } from '@/components/atoms'
import type { ClubKioskCourtInfo } from '@shared/types'

export interface ClubKioskCardProps {
  court: ClubKioskCourtInfo
}

/**
 * ClubKioskCard — status-based card for club kiosk display.
 *
 * Renders differently based on clubStatus:
 * - AVAILABLE: green border, "Disponible" badge
 * - RESERVED: blue border, large PIN display, "Reservado" badge
 * - OCCUPIED (match/legacy): amber border, player names + score, "En Juego" badge
 * - OCCUPIED (free): green border, player names only, "En cancha — Modo Libre" badge
 * - FINISHED: gray border, final score, "Finalizado" badge
 *
 * PR 4 — when `sessionMode === 'free'`, the card MUST NOT render any score
 * numbers (spec: Free mode MUST NOT display scoring). Only names + badge
 * are displayed.
 */
export function ClubKioskCard({ court }: ClubKioskCardProps) {
  const { i18nText } = useI18n()

  const status = court.status
  const scoreA = court.currentScore?.a ?? 0
  const scoreB = court.currentScore?.b ?? 0
  const isFreeMode = status === 'OCCUPIED' && court.sessionMode === 'free'

  const borderColor =
    status === 'AVAILABLE' ? 'border-green-500/50' :
    status === 'RESERVED' ? 'border-blue-500/50' :
    isFreeMode ? 'border-green-500/50' :
    status === 'OCCUPIED' ? 'border-amber-500/50' :
    'border-gray-500/30'

  const badgeColor =
    status === 'AVAILABLE' ? 'bg-green-500/15 text-green-400' :
    status === 'RESERVED' ? 'bg-blue-500/15 text-blue-400' :
    isFreeMode ? 'bg-green-500/15 text-green-400' :
    status === 'OCCUPIED' ? 'bg-amber-500/15 text-amber-400' :
    'bg-gray-500/15 text-gray-400'

  const badgeLabel =
    status === 'AVAILABLE' ? i18nText('clubKioskAvailable') :
    status === 'RESERVED' ? i18nText('clubKioskReserved') :
    isFreeMode ? i18nText('clubKioskFreeBadge') :
    status === 'OCCUPIED' ? i18nText('clubKioskOccupied') :
    i18nText('clubKioskFinished')

  return (
    <div
      className={`
        card bg-surface shadow-lg rounded-3xl p-5 flex flex-col gap-3
        border-2 ${borderColor}
      `}
    >
      {/* Court name + status badge */}
      <div className="flex items-center justify-between gap-2">
        <Typography variant="title" className="text-xl font-bold truncate">
          {court.name}
        </Typography>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      {/* RESERVED: large PIN display */}
      {status === 'RESERVED' && court.pin && (
        <div className="flex-1 flex items-center justify-center py-4">
          <span className="text-4xl font-mono font-bold tracking-widest text-text-h">
            {court.pin}
          </span>
        </div>
      )}

      {/* FREE MODE (OCCUPIED + sessionMode='free'): names only, no scores */}
      {isFreeMode && (
        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <Typography variant="label" className="text-sm normal-case text-lg">
              {court.playerNames?.a || 'Jugador 1'}
            </Typography>
          </div>
          <Typography variant="label" className="text-text/40 normal-case text-lg">
            {i18nText('commonVs')}
          </Typography>
          <div className="flex flex-col items-center gap-1">
            <Typography variant="label" className="text-sm normal-case text-lg">
              {court.playerNames?.b || 'Jugador 2'}
            </Typography>
          </div>
        </div>
      )}

      {/* OCCUPIED (match/legacy) / FINISHED: player names + score */}
      {(status === 'OCCUPIED' || status === 'FINISHED') && !isFreeMode && (
        <div className="flex-1 flex items-center justify-center gap-4">
          {/* Player A */}
          <div className="flex flex-col items-center gap-1">
            <span
              data-testid="score-a"
              className="font-heading font-bold leading-none text-text-h text-4xl"
            >
              {scoreA}
            </span>
            <Typography variant="label" className="text-sm normal-case">
              {court.playerNames?.a || 'Jugador 1'}
            </Typography>
          </div>

          {/* VS */}
          <Typography variant="label" className="text-text/40 normal-case text-lg">
            {i18nText('commonVs')}
          </Typography>

          {/* Player B */}
          <div className="flex flex-col items-center gap-1">
            <span
              data-testid="score-b"
              className="font-heading font-bold leading-none text-text-h text-4xl"
            >
              {scoreB}
            </span>
            <Typography variant="label" className="text-sm normal-case">
              {court.playerNames?.b || 'Jugador 2'}
            </Typography>
          </div>
        </div>
      )}
    </div>
  )
}
