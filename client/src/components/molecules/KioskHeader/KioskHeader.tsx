import { QRCodeSVG } from 'qrcode.react';
import logoBig from '@/assets/logo-big.png';
import { useI18n } from '@/i18n';
import { Typography } from '@/components/atoms';
import type { HubConfigData } from '@/hooks/useSocketState';

export interface KioskHeaderProps {
  title?: string;
  hubConfig?: HubConfigData | null;
}

export function KioskHeader({ title, hubConfig }: KioskHeaderProps) {
  const { i18nText } = useI18n();

  return (
    <header className="flex items-center justify-between px-8 pt-6 pb-4 select-none">
      {/* Logo + Title */}
      <div className="flex items-center gap-6">
        <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/10 shadow-md">
          <img src={logoBig} alt="RallyOS" style={{ height: 120 }} className="w-auto rounded-2xl" />
        </div>
        {title && (
          <Typography variant="headline" className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow">
            {title}
          </Typography>
        )}
      </div>

      {/* QR Codes — WiFi + URL */}
      {hubConfig?.domain && (
        <div className="flex flex-row items-start gap-6">
          {/* WiFi QR (Conditional) */}
          {hubConfig.wifiPassword && (
            <div className="flex flex-col items-center gap-2 bg-slate-900/60 p-3 rounded-2xl border border-white/10 shadow-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                {i18nText('scoreboardWifiQrCta')}
              </span>
              <QRCodeSVG
                value={`WIFI:T:WPA2;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};H:false;;`}
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={true}
                className="rounded-lg"
              />
            </div>
          )}

          {/* URL QR (Always) */}
          <div className="flex flex-col items-center gap-2 bg-slate-900/60 p-3 rounded-2xl border border-white/10 shadow-md">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
              {i18nText('scoreboardUrlQrCta')}
            </span>
          <QRCodeSVG
                value={`https://${hubConfig.domain}:${hubConfig.port}`}
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={true}
                className="rounded-lg"
              />
            <Typography variant="label" className="text-white/80 text-[11px] font-mono tracking-wider">
              https://{hubConfig.domain}:{hubConfig.port}
            </Typography>
          </div>
        </div>
      )}
    </header>
  );
}
