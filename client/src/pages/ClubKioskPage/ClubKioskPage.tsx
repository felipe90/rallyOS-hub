import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocketContext } from '@/contexts/SocketContext'
import { useI18n } from '@/i18n'
import { Typography } from '@/components/atoms'
import { ClubKioskCard } from '@/components/organisms/ClubKioskCard'
import { KioskHeader } from '@/components/molecules/KioskHeader'
import { KioskSportsTicker } from '@/components/organisms/KioskSportsTicker'
import { SocketEvents } from '@shared/events'
import type { ClubKioskPayload } from '@shared/types'

/** Cards per page for auto-rotation */
const PAGE_SIZE = 8

/** Rotation interval in milliseconds */
const ROTATION_INTERVAL_MS = 10_000

/**
 * ClubKioskPage — staff-facing kiosk for club-mode hubs.
 *
 * Subscribes to CLUB_KIOSK_DATA for live updates and renders
 * a responsive grid of ClubKioskCard components with auto-rotation.
 */
export function ClubKioskPage() {
  const { socket, hubConfig } = useSocketContext()
  const { i18nText } = useI18n()
  const [courts, setCourts] = useState<ClubKioskPayload['courts']>([])
  const [clubName, setClubName] = useState('Club')
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(courts.length / PAGE_SIZE))
  const visibleCourts = courts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset to first page when courts change
  useEffect(() => {
    setPage(0)
  }, [courts.length])

  // Rotation timer
  useEffect(() => {
    if (totalPages <= 1) return

    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages)
    }, ROTATION_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [totalPages])

  useEffect(() => {
    if (!socket) return

    const handleKioskData = (payload: ClubKioskPayload) => {
      setCourts(payload.courts)
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
                className="absolute inset-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 content-start overflow-y-auto"
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

      <KioskSportsTicker defaultText="BIENVENIDOS A RALLYOS" />
    </div>
  )
}
