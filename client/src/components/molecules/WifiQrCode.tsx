import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/i18n'
import { Typography } from '@/components/atoms'
import type { HubConfigData } from '@/hooks/useSocketState'

interface WifiQrCodeProps {
  hubConfig: HubConfigData | null
  /** QR size in pixels (default 200) */
  size?: number
}

export function WifiQrCode({ hubConfig, size = 200 }: WifiQrCodeProps) {
  const { i18nText } = useI18n()

  if (!hubConfig?.domain) return null

  return (
    <div className="flex flex-col items-center gap-2 pb-6">
      {hubConfig.wifiPassword && (
        <QRCodeSVG
          value={`WIFI:T:WPA;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};;`}
          size={size}
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
  )
}
