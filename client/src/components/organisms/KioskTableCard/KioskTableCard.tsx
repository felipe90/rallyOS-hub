import { useI18n } from '@/i18n'
import { LiveBadge, WaitingBadge, FinishedBadge, Typography } from '@/components/atoms'
import type { TableInfo } from '@shared/types'

export interface KioskTableCardProps {
  table: TableInfo
  className?: string
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

export function KioskTableCard({ table, className = '' }: KioskTableCardProps) {
  const { i18nText } = useI18n()
  const scoreA = table.currentScore?.a ?? 0
  const scoreB = table.currentScore?.b ?? 0

  return (
    <div
      className={`
        bg-surface shadow-lg rounded-3xl p-6 md:p-8
        flex flex-col gap-4
        ${className}
      `}
    >
      {/* Table name + status */}
      <div className="flex items-center justify-between gap-3">
        <Typography variant="title" className="text-2xl md:text-3xl truncate">
          {table.name}
        </Typography>
        <KioskStatusBadge status={table.status} labels={i18nText} />
      </div>

      {/* Scores */}
      <div className="flex items-center justify-center gap-6">
        {/* Player A score */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-heading font-bold text-5xl md:text-6xl leading-none text-text-h">
            {scoreA}
          </span>
          <Typography variant="label" className="text-xl md:text-2xl normal-case">
            {table.playerNames?.a || i18nText('commonPlayerA')}
          </Typography>
        </div>

        {/* VS divider */}
        <Typography variant="label" className="text-2xl text-text/40 normal-case">
          {i18nText('commonVs')}
        </Typography>

        {/* Player B score */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-heading font-bold text-5xl md:text-6xl leading-none text-text-h">
            {scoreB}
          </span>
          <Typography variant="label" className="text-xl md:text-2xl normal-case">
            {table.playerNames?.b || i18nText('commonPlayerB')}
          </Typography>
        </div>
      </div>
    </div>
  )
}
