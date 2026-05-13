import { useEffect } from 'react'
import { useI18n, changeLanguage } from '@/i18n'
import { useSocketContext } from '@/contexts/SocketContext'
import { ConnectionStatus, Typography } from '@/components/atoms'
import { KioskTableCard } from '@/components/organisms/KioskTableCard'
import { QRCodeSVG } from 'qrcode.react'
import type { TableInfo } from '@shared/types'

/** Active table statuses shown on the kiosk */
const ACTIVE_STATUSES: TableInfo['status'][] = ['LIVE', 'WAITING']

export function KioskAllTablesPage() {
  const { tables, connected, connecting, hubConfig } = useSocketContext()
  const { i18nText } = useI18n()

  // Spanish default on TV scoreboard
  useEffect(() => {
    const explicit = localStorage.getItem('rallyos-lang-explicit')
    if (!explicit) changeLanguage('es')
  }, [])

  // Auto-reload when socket permanently disconnects (all retries exhausted)
  useEffect(() => {
    if (!connected && !connecting) {
      const timer = setTimeout(() => window.location.reload(), 10_000)
      return () => clearTimeout(timer)
    }
  }, [connected, connecting])

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

      {/* WiFi QR Code + Domain Link — visible on all scoreboard views */}
      {hubConfig?.domain && (
        <div className="flex flex-col items-center gap-2 pb-6">
          {hubConfig.wifiPassword && (
            <QRCodeSVG
              value={`WIFI:T:WPA;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};;`}
              size={200}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              includeMargin={true}
            />
          )}
          <Typography variant="label" className="text-center text-text/80 text-sm">
            {i18nText('scoreboardWifiDomain', { domain: hubConfig.domain })}
          </Typography>
        </div>
      )}
    </div>
  )
}
