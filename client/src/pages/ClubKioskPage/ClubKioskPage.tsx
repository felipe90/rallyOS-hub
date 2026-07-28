import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocketContext } from '@/contexts/SocketContext'
import { useI18n } from '@/i18n'
import { Typography } from '@/components/atoms'
import { ClubKioskCard } from '@/components/organisms/ClubKioskCard'
import { KioskHeader } from '@/components/molecules/KioskHeader'
import { KioskSportsTicker } from '@/components/organisms/KioskSportsTicker'
import { KioskScoreboard } from '@/components/organisms/KioskScoreboard'
import { SocketEvents } from '@shared/events'
import { Table2 } from 'lucide-react'
import type { ClubKioskPayload, MatchStateExtended } from '@shared/types'

/** Cards per page for auto-rotation */
const PAGE_SIZE = 8

/** Rotation interval in milliseconds */
const ROTATION_INTERVAL_MS = 10_000

/**
 * ClubKioskPage — staff-facing kiosk for club-mode hubs.
 *
 * Subscribes to CLUB_KIOSK_DATA for live updates and renders
 * a responsive grid of ClubKioskCard components with auto-rotation.
 *
 * Spotlight mode: when a court is featured AND OCCUPIED in match mode
 * (sessionMode !== 'free'), the kiosk switches to a full-screen scoreboard
 * view with real-time MATCH_UPDATE subscription — same as tournament spotlight.
 * Free-mode featured courts stay in the grid with a glow/badge indicator.
 */
export function ClubKioskPage() {
  const { socket, hubConfig, kioskNotification } = useSocketContext()
  const { i18nText } = useI18n()
  const [courts, setCourts] = useState<ClubKioskPayload['courts']>([])
  const [clubName, setClubName] = useState('Club')
  const [page, setPage] = useState(0)
  const [spotlightMatch, setSpotlightMatch] = useState<MatchStateExtended | null>(null)

  const totalPages = Math.max(1, Math.ceil(courts.length / PAGE_SIZE))
  const visibleCourts = courts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Detect featured match-mode court for spotlight
  const featuredMatchCourt = courts.find(
    c => c.featured === true && c.status === 'OCCUPIED' && c.sessionMode !== 'free',
  )
  const spotlightCourtId = featuredMatchCourt?.id ?? null
  const isSpotlight = spotlightCourtId !== null

  // Reset to first page when courts change
  useEffect(() => {
    setPage(0)
  }, [courts.length])

  // Rotation timer — only when NOT in spotlight
  useEffect(() => {
    if (isSpotlight || totalPages <= 1) return

    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages)
    }, ROTATION_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [totalPages, isSpotlight])

  useEffect(() => {
    if (!socket) return

    const handleKioskData = (payload: ClubKioskPayload) => {
      // Sort featured court to first position so it appears first in grid
      const sorted = [...payload.courts].sort((a, b) => {
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1
        return 0
      })
      setCourts(sorted)
      setClubName(payload.clubName)
    }

    socket.on(SocketEvents.SERVER.CLUB_KIOSK_DATA, handleKioskData)

    // Request initial data explicitly — CLUB_KIOSK_DATA at connection time
    // may arrive before this component mounts (race condition)
    socket.emit(SocketEvents.CLIENT.CLUB_GET_CONFIG)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_KIOSK_DATA, handleKioskData)
    }
  }, [socket])

  // Spotlight: subscribe/unsubscribe to match updates for the featured match court
  useEffect(() => {
    if (!socket || !spotlightCourtId) return

    socket.emit(SocketEvents.CLIENT.SUBSCRIBE_MATCH, { courtId: spotlightCourtId })

    return () => {
      socket.emit(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH, { courtId: spotlightCourtId })
    }
  }, [socket, spotlightCourtId])

  // Spotlight: listen for MATCH_UPDATE events
  useEffect(() => {
    if (!socket || !spotlightCourtId) {
      setSpotlightMatch(null)
      return
    }

    const handleMatchUpdate = (match: MatchStateExtended) => {
      setSpotlightMatch(match)
    }

    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)

    return () => {
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    }
  }, [socket, spotlightCourtId])

  // Spotlight mode — full-screen Destacado bar + KioskScoreboard
  if (isSpotlight) {
    return (
      <div className="h-dvh stadium-bg flex flex-col">
        {/* Destacado bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[var(--color-stadium-surface)] border-b border-[var(--color-stadium-border)]">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-sm tracking-wide">
              {i18nText('kioskDestacado')}
            </span>
          </div>
          <Typography variant="body" className="font-semibold text-text-h text-base">
            {featuredMatchCourt?.name ?? ''}
          </Typography>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400">
            En Vivo
          </span>
        </div>

        {/* Spotlight KioskScoreboard with animated transitions */}
        <main className="flex-1 flex flex-col relative">
          <AnimatePresence mode="wait">
            {spotlightMatch ? (
              <motion.div
                key={spotlightCourtId}
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

        <KioskSportsTicker
          notification={kioskNotification?.scope === 'general' ? null : kioskNotification}
          defaultText="BIENVENIDOS A RALLYOS"
          defaultTexts={['▶ CANCHAS DISPONIBLES', '▶ RESERVAS', '▶ ESCANEA QR PARA JUGAR']}
        />
      </div>
    )
  }

  // Normal grid mode (no spotlight or free-mode featured court)
  return (
    <div className="h-dvh stadium-bg flex flex-col">
      <KioskHeader title={clubName} hubConfig={hubConfig} />

      {/* Empty state */}
      {courts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Typography variant="title" className="text-xl text-text-muted text-center px-4">
            {i18nText('clubKioskNoCourts')}
          </Typography>
        </div>
      ) : (
        <>
          {/* Grid with animated transitions */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 content-start overflow-y-auto"
              >
                {visibleCourts.map((court) => (
                  <ClubKioskCard key={court.id} court={court} />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Page indicator dots — only show when more than one page */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pb-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <div
                  key={i}
                  data-active={i === page}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    i === page ? 'bg-primary' : 'bg-primary/30'
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}

      <KioskSportsTicker
        notification={kioskNotification?.scope === 'general' ? null : kioskNotification}
        defaultText="BIENVENIDOS A RALLYOS"
        defaultTexts={['▶ CANCHAS DISPONIBLES', '▶ RESERVAS', '▶ ESCANEA QR PARA JUGAR']}
      />
    </div>
  )
}
