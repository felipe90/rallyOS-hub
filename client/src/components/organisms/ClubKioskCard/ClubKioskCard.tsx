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
        stadium-card rounded-2xl p-5 flex flex-col gap-3
        border-2 ${borderColor} transition-all duration-300 hover:scale-[1.01]
      `}
    >
      {/* Court name + status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="bg-black/30 px-4 py-1.5 rounded-full">
          <Typography variant="title" className="text-base font-bold text-white tracking-wide">
            {court.name}
          </Typography>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 ${badgeColor}`}>
          {status === 'OCCUPIED' && !isFreeMode && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
          {badgeLabel}
        </span>
      </div>

      {/* playerName — shown only when OCCUPIED (non-free) and playerName is present */}
      {status === 'OCCUPIED' && !isFreeMode && court.playerName && (
        <div className="flex items-center justify-center gap-1 -mt-1">
          <Typography variant="label" className="text-xs text-white/70 normal-case font-medium">
            {court.playerName}
          </Typography>
        </div>
      )}

      {/* RESERVED: Digital Vault Box PIN display */}
      {status === 'RESERVED' && court.pin && (
        <div className="flex-1 flex flex-col items-center justify-center py-3">
          <div className="px-6 py-2 rounded-2xl bg-[#001915]/90 border border-amber-500/40 shadow-inner flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">PIN DE INGRESO</span>
            <span className="text-4xl font-mono font-bold tracking-[0.25em] text-amber-300 glow-text-amber">
              {court.pin}
            </span>
          </div>
        </div>
      )}

      {/* FREE MODE (OCCUPIED + sessionMode='free'): single player name only, no scores, no vs */}
      {isFreeMode && (
        <div className="flex-1 flex items-center justify-center py-2">
          <Typography variant="title" className="text-xl md:text-2xl font-bold text-white text-center">
            {court.playerName || court.playerNames?.a || 'Jugador'}
          </Typography>
        </div>
      )}

      {/* OCCUPIED (match/legacy) / FINISHED: player names + score */}
      {(status === 'OCCUPIED' || status === 'FINISHED') && !isFreeMode && (
        <div className="flex-1 flex items-center justify-center gap-5">
          {/* Player A */}
          <div className="flex flex-col items-center gap-1">
            <span
              data-testid="score-a"
              className="font-heading font-bold leading-none text-white text-4xl md:text-5xl tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            >
              {scoreA}
            </span>
            <Typography variant="label" className="text-xs md:text-sm text-white/80 normal-case font-medium">
              {court.playerNames?.a || 'Jugador 1'}
            </Typography>
          </div>

          {/* Neon Crystal VS Divider */}
          <div className="w-12 h-12 rounded-full bg-primary-light/10 border border-[var(--color-stadium-border)] flex items-center justify-center">
            <span className="text-primary-light font-heading font-bold text-sm">VS</span>
          </div>

          {/* Player B */}
          <div className="flex flex-col items-center gap-1">
            <span
              data-testid="score-b"
              className="font-heading font-bold leading-none text-white text-4xl md:text-5xl tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            >
              {scoreB}
            </span>
            <Typography variant="label" className="text-xs md:text-sm text-white/80 normal-case font-medium">
              {court.playerNames?.b || 'Jugador 2'}
            </Typography>
          </div>
        </div>
      )}
    </div>
  )
}
