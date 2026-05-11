import { useI18n } from '@/i18n'
import { useSocketContext } from '@/contexts/SocketContext'
import { ConnectionStatus, Typography } from '@/components/atoms'
import { KioskTableCard } from '@/components/organisms/KioskTableCard'
import type { TableInfo } from '@shared/types'

/** Active table statuses shown on the kiosk */
const ACTIVE_STATUSES: TableInfo['status'][] = ['LIVE', 'WAITING']

export function KioskAllTablesPage() {
  const { tables } = useSocketContext()
  const { i18nText } = useI18n()

  const activeTables = tables.filter((t) => ACTIVE_STATUSES.includes(t.status))

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Connection indicator */}
      <ConnectionStatus
        labels={{
          connected: i18nText('connectionConnected'),
          connecting: i18nText('connectionConnecting'),
          error: i18nText('connectionNoConnection'),
          disconnected: i18nText('connectionDisconnected'),
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <Typography variant="headline" className="text-3xl md:text-4xl">
          {i18nText('kioskPageTitle')}
        </Typography>
      </div>

      {/* Content */}
      {activeTables.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Typography variant="title" className="text-2xl text-text/60 text-center px-4">
            {i18nText('kioskNoActiveMatches')}
          </Typography>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 flex-1 content-start">
          {activeTables.map((table) => (
            <KioskTableCard key={table.id} table={table} />
          ))}
        </div>
      )}
    </div>
  )
}
