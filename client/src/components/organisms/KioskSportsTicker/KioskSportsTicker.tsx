import { Bell } from 'lucide-react';
import type { KioskNotificationData } from '@shared/types';

export interface KioskSportsTickerProps {
  notification?: KioskNotificationData | null;
  defaultText?: string;
}

export function KioskSportsTicker({ notification, defaultText }: KioskSportsTickerProps) {
  const text = notification?.message || defaultText || 'BIENVENIDOS A RALLYOS — RESULTADOS Y PUNTUACIÓN EN TIEMPO REAL';

  return (
    <footer className="w-full bg-[#001915] border-t border-teal-500/20 text-white flex items-center h-12 overflow-hidden select-none z-30 shadow-2xl relative">
      {/* Broadcast Live Badge Indicator */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-600 px-4 h-full flex items-center gap-2 font-heading font-extrabold text-xs tracking-widest uppercase z-10 shadow-md">
        <Bell size={14} className="animate-pulse text-amber-300" />
        <span>RALLYOS LIVE</span>
      </div>

      {/* Marquee Ticker Stream */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        <div className="animate-marquee font-mono text-sm tracking-wider text-teal-100 font-semibold px-4">
          {text}
        </div>
      </div>
    </footer>
  );
}
