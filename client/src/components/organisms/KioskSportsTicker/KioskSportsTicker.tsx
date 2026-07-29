import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import type { KioskNotificationData } from '@shared/types';

export interface KioskSportsTickerProps {
  notification?: KioskNotificationData | null;
  defaultText?: string;
  /** Rotating default content when no active notification — cycles every 10s */
  defaultTexts?: string[];
}

export function KioskSportsTicker({ notification, defaultText, defaultTexts }: KioskSportsTickerProps) {
  const [liveNotification, setLiveNotification] = useState<KioskNotificationData | null>(null);
  const [defaultIndex, setDefaultIndex] = useState(0);
  const autoExpireRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manage notification lifecycle — important/error persist; info/warning auto-expire
  useEffect(() => {
    // Clear any pending auto-expire timer from previous notification
    if (autoExpireRef.current) {
      clearTimeout(autoExpireRef.current);
      autoExpireRef.current = null;
    }

    if (!notification) {
      setLiveNotification(null);
      return;
    }

    // Show the notification regardless of type
    setLiveNotification(notification);

    // Auto-expire only for info/warning — important/error persist until replaced
    if (notification.type === 'info' || notification.type === 'warning') {
      autoExpireRef.current = setTimeout(() => {
        setLiveNotification(null);
      }, notification.duration * 1000);
    }

    return () => {
      if (autoExpireRef.current) {
        clearTimeout(autoExpireRef.current);
        autoExpireRef.current = null;
      }
    };
  }, [notification]);

  // Rotate defaultTexts every 10s when no active notification
  useEffect(() => {
    if (liveNotification || !defaultTexts || defaultTexts.length === 0) return;

    const interval = setInterval(() => {
      setDefaultIndex((prev) => (prev + 1) % defaultTexts.length);
    }, 10_000);

    return () => clearInterval(interval);
  }, [liveNotification, defaultTexts]);

  // Reset rotation index when notification state or texts change
  useEffect(() => {
    setDefaultIndex(0);
  }, [liveNotification, defaultTexts]);

  const text = liveNotification?.message
    || (defaultTexts && defaultTexts.length > 0 ? defaultTexts[defaultIndex] : null)
    || defaultText
    || 'BIENVENIDOS A RALLYOS — RESULTADOS Y PUNTUACIÓN EN TIEMPO REAL';

  return (
    <footer className="w-full bg-[#001915] border-t border-teal-500/20 text-white flex items-center h-12 overflow-hidden select-none z-30 shadow-2xl relative">
      {/* Broadcast Live Badge Indicator */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-600 px-4 h-full flex items-center gap-2 font-heading font-extrabold text-xs tracking-widest uppercase z-10 shadow-md">
        <Bell size={14} className="animate-pulse text-amber-300" />
        <span>RALLYOS LIVE</span>
      </div>

      {/* Marquee Ticker Stream — seamless loop */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        <div className="animate-marquee font-mono text-sm tracking-wider text-teal-100 font-semibold whitespace-nowrap will-change-transform">
          <span className="px-4">{text}</span>
          <span className="px-4">{text}</span>
        </div>
      </div>
    </footer>
  );
}
