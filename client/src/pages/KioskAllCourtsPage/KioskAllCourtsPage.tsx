import { useEffect, useRef, useState } from 'react'
import { useI18n, changeLanguage } from '@/i18n'
import { useSocketContext } from '@/contexts/SocketContext'
import { ConnectionStatus, Typography, LiveBadge } from '@/components/atoms'
import { KioskCourtCard } from '@/components/organisms/KioskCourtCard'
import { KioskNotificationToast } from '@/components/organisms/KioskNotificationToast'
import { KioskScoreboard } from '@/components/organisms/KioskScoreboard'
import { QRCodeSVG } from 'qrcode.react'
import logoBig from '@/assets/logo-big.png'
import { motion, AnimatePresence } from 'framer-motion'
import { Table2 } from 'lucide-react'
import { SocketEvents } from '@shared/events'
import type { TableInfo, KioskNotificationData, MatchStateExtended } from '@shared/types'

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

export function KioskAllCourtsPage() {
  const { courts, connected, connecting, hubConfig, kioskNotification, socket } = useSocketContext()
  const { i18nText } = useI18n()

  // Rotation state
  const [pages, setPages] = useState<TableInfo[][]>([[]])
  const [currentPage, setCurrentPage] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // Featured court spotlight state
  const [featuredCourtId, setFeaturedCourtId] = useState<string | null>(null)
  const [spotlightMatch, setSpotlightMatch] = useState<MatchStateExtended | null>(null)
  const prevFeaturedIdRef = useRef<string | null>(null)
  const previousFeaturedIdForFadeRef = useRef<string | null>(null)

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

  const activeCourts = courts.filter((t) => ACTIVE_STATUSES.includes(t.status))
  const inSpotlight = featuredCourtId !== null

  // Detect featured court from courts — only LIVE/WAITING courts qualify
  useEffect(() => {
    const featured = courts.find(
      (t) => t.featured === true && ACTIVE_STATUSES.includes(t.status),
    )
    const newFeaturedId = featured?.id ?? null
    setFeaturedCourtId(newFeaturedId)
  }, [courts])

  // Subscribe/unsubscribe to featured court match updates
  useEffect(() => {
    if (!socket) return

    const prevId = prevFeaturedIdRef.current
    const currentId = featuredCourtId

    // Unsubscribe from previous featured court
    if (prevId && prevId !== currentId) {
      socket.emit(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH, { courtId: prevId })
    }

    // Subscribe to new featured court (only for LIVE/WAITING)
    if (currentId) {
      socket.emit(SocketEvents.CLIENT.SUBSCRIBE_MATCH, { courtId: currentId })
    }

    prevFeaturedIdRef.current = currentId

    return () => {
      if (currentId) {
        socket.emit(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH, { courtId: currentId })
      }
    }
  }, [socket, featuredCourtId])

  // Listen for MATCH_UPDATE on the socket directly
  useEffect(() => {
    if (!socket || !featuredCourtId) return

    const handleMatchUpdate = (match: MatchStateExtended) => {
      setSpotlightMatch(match)
    }

    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)

    return () => {
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    }
  }, [socket, featuredCourtId])

  // Reset match state when featured court changes
  useEffect(() => {
    const currentId = featuredCourtId

    if (inSpotlight && previousFeaturedIdForFadeRef.current !== null && previousFeaturedIdForFadeRef.current !== currentId) {
      setSpotlightMatch(null)
    }
    previousFeaturedIdForFadeRef.current = currentId
  }, [featuredCourtId, inSpotlight])

  // Page calculation — recalculate when courts change or window resizes
  useEffect(() => {
    const recalculate = () => {
      const active = courts.filter((t) => ACTIVE_STATUSES.includes(t.status))
      const newPages = calculatePages(active, window.innerWidth, window.innerHeight)
      setPages(newPages)
      setCurrentPage((prev) => (prev >= newPages.length ? Math.max(0, newPages.length - 1) : prev))
    }
    recalculate()
    window.addEventListener('resize', recalculate)
    return () => window.removeEventListener('resize', recalculate)
  }, [courts])

  // Rotation timer — advances currentPage when in rotation mode
  useEffect(() => {
    if (pages.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % pages.length)
    }, ROTATION_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [pages.length, isPaused])

  // Handle visibility change (TV sleep/wake) — pause rotation when hidden
  useEffect(() => {
    const handleVisibility = () => setIsPaused(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const isRotating = pages.length > 1

  // Find featured court info for the Destacado bar
  const featuredCourt = inSpotlight ? courts.find((t) => t.id === featuredCourtId) : null

  return (
    <div className="h-dvh bg-surface flex flex-col">
      {/* Spotlight mode: Destacado bar + KioskScoreboard (no header) */}
      {inSpotlight ? (
        <>
          {/* Destacado Bar (Task 3.3) */}
          <div className="flex items-center justify-between px-6 py-3 bg-surface border-b border-border/20">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-sm tracking-wide">
                {i18nText('kioskDestacado')}
              </span>
            </div>
            <Typography variant="body" className="font-semibold text-text-h text-base">
              {featuredCourt?.name ?? ''}
            </Typography>
            <LiveBadge label={i18nText('kioskEnVivo')} />
          </div>

          {/* Spotlight KioskScoreboard with fade */}
          <main id="main-content" className="flex-1 flex flex-col relative">
            <AnimatePresence mode="wait">
              {spotlightMatch ? (
                <motion.div
                  key={featuredCourtId ?? 'none'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex-1 flex flex-col absolute inset-0"
                >
                  <KioskScoreboard match={spotlightMatch} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex-1 flex flex-col items-center justify-center gap-4 absolute inset-0"
                >
                  <Table2 size={64} className="text-border" />
                  <Typography variant="title" className="text-2xl text-text-muted text-center px-4">
                    {i18nText('kioskNoActiveMatches')}
                  </Typography>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </>
      ) : (
        <>
          {/* Connection indicator */}
          <ConnectionStatus
            labels={{
              connected: i18nText('connectionConnected'),
              connecting: i18nText('connectionConnecting'),
              error: i18nText('connectionNoConnection'),
              disconnected: i18nText('connectionDisconnected'),
            }}
          />

          {/* Header — Logo + QR (visible only in non-spotlight mode) */}
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

          {/* Content — Grid / Rotation / Empty */}
          <main id="main-content" className="flex-1 flex flex-col">
          {activeCourts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Table2 size={64} className="text-border" />
              <Typography variant="title" className="text-2xl text-text-muted text-center px-4">
                {i18nText('kioskNoActiveMatches')}
              </Typography>
            </div>
          ) : isRotating ? (
            /* Rotation mode — show one page at a time with fade + indicators */
            <div className="flex-1 flex flex-col relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 absolute inset-0 content-start"
                >
                  {pages[currentPage]?.map((court) => (
                    <KioskCourtCard key={court.id} table={court} />
                  ))}
                </motion.div>
              </AnimatePresence>
              {/* Page indicators */}
              <div className="flex justify-center gap-2 pb-4 mt-auto z-10">
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
              {activeCourts.map((court) => (
                <KioskCourtCard key={court.id} table={court} condensed />
              ))}
            </div>
          )}
          </main>
        </>
      )}

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
