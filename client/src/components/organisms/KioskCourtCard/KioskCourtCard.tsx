import { useI18n } from '@/i18n'
import { LiveBadge, WaitingBadge, FinishedBadge, Typography } from '@/components/atoms'
import type { TableInfo } from '@shared/types'

export interface KioskCourtCardProps {
  table: TableInfo
  className?: string
  condensed?: boolean
}

function KioskStatusBadge({
  status,
  labels,
}: {
  status: TableInfo['status']
  labels: ReturnType<typeof useI18n>['i18nText']
}) {
  switch (status) {
    case 'LIVE':
      return <LiveBadge label={labels('kioskStatusLive')} />
    case 'WAITING':
      return <WaitingBadge label={labels('kioskStatusPaused')} />
    case 'FINISHED':
      return <FinishedBadge label={labels('kioskStatusFinished')} />
    case 'CONFIGURING':
      return <WaitingBadge label={labels('kioskStatusPaused')} />
    default:
      return null
  }
}

export function KioskCourtCard({ table, className = '', condensed = false }: KioskCourtCardProps) {
  const { i18nText } = useI18n()
  const scoreA = table.currentScore?.a ?? 0
  const scoreB = table.currentScore?.b ?? 0
  const currentSets = table.currentSets

  const isLive = table.status === 'LIVE'
  const isWaiting = table.status === 'WAITING'

  const borderStyle = isLive ? 'border-emerald-500/50 glow-border-emerald' : isWaiting ? 'border-blue-500/40' : 'border-white/10'

  return (
    <div
      data-condensed={condensed ? 'true' : 'false'}
      className={`
        card stadium-card rounded-3xl border-2 ${borderStyle}
        ${condensed ? 'p-4 md:p-5' : 'p-6 md:p-8'}
        flex flex-col gap-4 transition-all duration-300 hover:scale-[1.01]
        ${className}
      `}
    >
      {/* Table name + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="bg-black/30 px-4 py-1.5 rounded-full">
          <Typography variant="title" className={`font-bold text-white tracking-wide truncate ${condensed ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
            {table.name}
          </Typography>
        </div>
        <KioskStatusBadge status={table.status} labels={i18nText} />
      </div>

      {/* Scores */}
      <div className="flex items-center justify-center gap-6">
        {/* Player A score */}
        <div className="flex flex-col items-center gap-1">
          <span className={`font-heading font-bold leading-none text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] ${condensed ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}`}>
            {scoreA}
          </span>
          <Typography variant="label" className={`normal-case text-white/80 font-medium ${condensed ? 'text-base md:text-lg' : 'text-lg md:text-xl'}`}>
            {table.playerNames?.a || i18nText('commonPlayerA')}
          </Typography>
        </div>

        {/* Neon Crystal VS Divider */}
        <div className="w-12 h-12 rounded-full bg-primary-light/10 border border-[var(--color-stadium-border)] flex items-center justify-center">
          <span className="text-primary-light font-heading font-bold text-sm">VS</span>
        </div>

        {/* Player B score */}
        <div className="flex flex-col items-center gap-1">
          <span className={`font-heading font-bold leading-none text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] ${condensed ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}`}>
            {scoreB}
          </span>
          <Typography variant="label" className={`normal-case text-white/80 font-medium ${condensed ? 'text-base md:text-lg' : 'text-lg md:text-xl'}`}>
            {table.playerNames?.b || i18nText('commonPlayerB')}
          </Typography>
        </div>
      </div>

      {/* Set scores */}
      {currentSets && (currentSets.a > 0 || currentSets.b > 0) && (
        <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-white/10">
          <Typography variant="label" className={`text-teal-300/80 normal-case font-semibold ${condensed ? 'text-sm md:text-base' : 'text-base md:text-lg'}`}>
            Sets:
          </Typography>
          <span className={`font-heading font-bold leading-none text-white tabular-nums ${condensed ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
            {currentSets.a} - {currentSets.b}
          </span>
        </div>
      )}
    </div>
  )
}
