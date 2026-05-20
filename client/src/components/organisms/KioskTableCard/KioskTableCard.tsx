import { useI18n } from '@/i18n'
import { LiveBadge, WaitingBadge, FinishedBadge, Typography } from '@/components/atoms'
import type { TableInfo } from '@shared/types'

export interface KioskTableCardProps {
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

export function KioskTableCard({ table, className = '', condensed = false }: KioskTableCardProps) {
  const { i18nText } = useI18n()
  const scoreA = table.currentScore?.a ?? 0
  const scoreB = table.currentScore?.b ?? 0
  const currentSets = table.currentSets

  return (
    <div
      data-condensed={condensed ? 'true' : 'false'}
      className={`
        bg-surface shadow-lg rounded-3xl
        ${condensed ? 'p-4 md:p-5' : 'p-6 md:p-8'}
        flex flex-col gap-4
        ${className}
      `}
    >
      {/* Table name + status */}
      <div className="flex items-center justify-between gap-3">
        <Typography variant="title" className={`truncate ${condensed ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}>
          {table.name}
        </Typography>
        <KioskStatusBadge status={table.status} labels={i18nText} />
      </div>

      {/* Scores */}
      <div className="flex items-center justify-center gap-6">
        {/* Player A score */}
        <div className="flex flex-col items-center gap-1">
          <span className={`font-heading font-bold leading-none text-text-h ${condensed ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}`}>
            {scoreA}
          </span>
          <Typography variant="label" className={`normal-case ${condensed ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
            {table.playerNames?.a || i18nText('commonPlayerA')}
          </Typography>
        </div>

        {/* VS divider */}
        <Typography variant="label" className={`text-text/40 normal-case ${condensed ? 'text-xl' : 'text-2xl'}`}>
          {i18nText('commonVs')}
        </Typography>

        {/* Player B score */}
        <div className="flex flex-col items-center gap-1">
          <span className={`font-heading font-bold leading-none text-text-h ${condensed ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}`}>
            {scoreB}
          </span>
          <Typography variant="label" className={`normal-case ${condensed ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
            {table.playerNames?.b || i18nText('commonPlayerB')}
          </Typography>
        </div>
      </div>

      {/* Set scores */}
      {currentSets && (currentSets.a > 0 || currentSets.b > 0) && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <Typography variant="label" className={`text-text/50 normal-case ${condensed ? 'text-base md:text-lg' : 'text-lg md:text-xl'}`}>
            Sets:
          </Typography>
          <span className={`font-heading font-bold leading-none text-text-h ${condensed ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}>
            {currentSets.a} - {currentSets.b}
          </span>
        </div>
      )}
    </div>
  )
}
