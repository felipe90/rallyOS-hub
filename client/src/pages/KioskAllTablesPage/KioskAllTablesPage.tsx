import { useEffect, useRef, useState } from 'react'
import { useI18n, changeLanguage } from '@/i18n'
import { useSocketContext } from '@/contexts/SocketContext'
import { ConnectionStatus, Typography } from '@/components/atoms'
import { KioskTableCard } from '@/components/organisms/KioskTableCard'
import { KioskNotificationToast } from '@/components/organisms/KioskNotificationToast'
import { QRCodeSVG } from 'qrcode.react'
import logoBig from '@/assets/logo-big.png'
import type { TableInfo, KioskNotificationData } from '@shared/types'

/** Active table statuses shown on the kiosk */
const ACTIVE_STATUSES: TableInfo['status'][] = ['LIVE', 'WAITING']

/** Layout constants for page calculation */
export const HEADER_HEIGHT = 180
export const CARD_HEIGHT = 200
export const CARD_GAP = 24
export const ROTATION_INTERVAL_MS = 10_000

/**
 * Split tables into pages that each fit the viewport without scrolling.
 * @param tables  - Active tables to paginate
 * @param viewportWidth  - window.innerWidth
 * @param viewportHeight - window.innerHeight
 * @returns Array of page chunks; always at least `[[]]` for zero tables.
 */
export function calculatePages(
  tables: TableInfo[],
  viewportWidth: number,
  viewportHeight: number,
): TableInfo[][] {
  const COLUMNS = viewportWidth >= 1280 ? 3 : viewportWidth >= 768 ? 2 : 1
  const availableHeight = viewportHeight - HEADER_HEIGHT
  const rowsPerPage = Math.max(1, Math.floor(availableHeight / (CARD_HEIGHT + CARD_GAP)))
  const cardsPerPage = rowsPerPage * COLUMNS

  if (tables.length === 0) return [[]]

  const pages: TableInfo[][] = []
  for (let i = 0; i < tables.length; i += cardsPerPage) {
    pages.push(tables.slice(i, i + cardsPerPage))
  }
  return pages
}

export function KioskAllTablesPage() {
  const { tables, connected, connecting, hubConfig, kioskNotification } = useSocketContext()
  const { i18nText } = useI18n()

  // Rotation state
  const [pages, setPages] = useState<TableInfo[][]>([[]])
  const [currentPage, setCurrentPage] = useState(0)
  const [fadeState, setFadeState] = useState<'visible' | 'hidden'>('visible')
  const [isPaused, setIsPaused] = useState(false)

  // Notification toast visibility
  const [visibleNotification, setVisibleNotification] = useState<KioskNotificationData | null>(null)
  const prevTimestampRef = useRef<number | null>(null)

  // Show toast when a new kioskNotification arrives (tracked by timestamp)
  useEffect(() => {
    if (kioskNotification && kioskNotification.timestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = kioskNotification.timestamp
      setVisibleNotification(kioskNotification)
    }
  }, [kioskNotification])

  // Spanish default on TV scoreboard
  useEffect(() => {
    const explicit = localStorage.getItem('rallyos-lang-explicit')
    if (!explicit) changeLanguage('es')
  }, [])

  // Prevent overscroll on kiosk page
  useEffect(() => {
    document.body.classList.add('kiosk-page')
    return () => { document.body.classList.remove('kiosk-page') }
  }, [])

  // Auto-reload when socket permanently disconnects (all retries exhausted)
  useEffect(() => {
    if (!connected && !connecting) {
      const timer = setTimeout(() => window.location.reload(), 10_000)
      return () => clearTimeout(timer)
    }
  }, [connected, connecting])

  const activeTables = tables.filter((t) => ACTIVE_STATUSES.includes(t.status))

  // Page calculation — recalculate when tables change or window resizes
  useEffect(() => {
    const recalculate = () => {
      const active = tables.filter((t) => ACTIVE_STATUSES.includes(t.status))
      const newPages = calculatePages(active, window.innerWidth, window.innerHeight)
      setPages(newPages)
      setCurrentPage((prev) => (prev >= newPages.length ? Math.max(0, newPages.length - 1) : prev))
    }
    recalculate()
    window.addEventListener('resize', recalculate)
    return () => window.removeEventListener('resize', recalculate)
  }, [tables])

  // Rotation timer — advances currentPage when in rotation mode
  useEffect(() => {
    if (pages.length <= 1 || isPaused) return

    let fadeTimeout: ReturnType<typeof setTimeout> | null = null

    const interval = setInterval(() => {
      // Fade out current page
      setFadeState('hidden')
      // After fade-out duration, advance page and fade in
      fadeTimeout = setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % pages.length)
        setFadeState('visible')
      }, 500)
    }, ROTATION_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (fadeTimeout) clearTimeout(fadeTimeout)
    }
  }, [pages.length, isPaused])

  // Handle visibility change (TV sleep/wake) — pause rotation when hidden
  useEffect(() => {
    const handleVisibility = () => setIsPaused(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const isRotating = pages.length > 1

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

      {/* Header — Logo + QR (always visible) */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4">
        <img src={logoBig} alt="RallyOS" style={{ height: 180 }} className="w-auto rounded-[--radius-md]" />
        {hubConfig?.domain && (
          <div className="flex flex-row items-start gap-6">
            {/* WiFi QR — conditional */}
            {hubConfig.wifiPassword && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-semibold">{i18nText('scoreboardWifiQrCta')}</span>
                <QRCodeSVG
                  value={`WIFI:T:WPA2;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};H:false;;`}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin={true}
                />
              </div>
            )}
            {/* URL QR — always visible */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-semibold">{i18nText('scoreboardUrlQrCta')}</span>
              <QRCodeSVG
                value={`https://${hubConfig.domain}:${hubConfig.port}`}
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={true}
              />
              <Typography variant="label" className="text-text/80 text-xs font-mono">
                https://{hubConfig.domain}:{hubConfig.port}
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <main id="main-content" className="flex-1 flex flex-col">
      {activeTables.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Typography variant="title" className="text-2xl text-text-muted text-center px-4">
            {i18nText('kioskNoActiveMatches')}
          </Typography>
        </div>
      ) : isRotating ? (
        /* Rotation mode — show one page at a time with fade + indicators */
        <div className="flex-1 flex flex-col">
          <div
            key={currentPage}
            className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 flex-1 content-start transition-opacity duration-500 ${
              fadeState === 'visible' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {pages[currentPage]?.map((table) => (
              <KioskTableCard key={table.id} table={table} />
            ))}
          </div>
          {/* Page indicators */}
          <div className="flex justify-center gap-2 pb-4">
            {pages.map((_, i) => (
              <div
                key={i}
                data-testid={`page-dot-${i}`}
                data-active={i === currentPage}
                className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                  i === currentPage ? 'bg-primary' : 'bg-primary/30'
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Static mode — all cards fit, render with tighter spacing */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6 flex-1 content-start">
          {activeTables.map((table) => (
            <KioskTableCard key={table.id} table={table} condensed />
          ))}
        </div>
      )}
      </main>

      {/* Kiosk Notification Toast */}
      {visibleNotification && (
        <KioskNotificationToast
          notification={visibleNotification}
          onDismiss={() => setVisibleNotification(null)}
          kioskMode
        />
      )}
    </div>
  )
}
