import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSocketContext } from '@/contexts/SocketContext'
import { SocketEvents } from '@shared/events'
import type { ClubConfig } from '@shared/types'
import { KioskAllCourtsPage } from '@/pages/KioskAllCourtsPage'
import { ClubKioskPage } from '@/pages/ClubKioskPage'

type Mode = 'loading' | 'club' | 'tournament'

/**
 * KioskPage — auto-detect wrapper with URL override
 *
 * Route-based mode selection:
 * - /kiosk/club       → always club kiosk
 * - /kiosk/tournament → always tournament kiosk
 * - /kiosk            → auto-detect (club if configured, else tournament)
 */
export function KioskPage() {
  const { socket } = useSocketContext()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('loading')
  const hasResolved = useRef(false)

  // URL-based mode override — bypasses auto-detect
  const forceMode = location.pathname.includes('/kiosk/club') ? 'club'
    : location.pathname.includes('/kiosk/tournament') || location.pathname.includes('/scoreboard/all/kiosk') ? 'tournament'
    : null

  useEffect(() => {
    // If URL forces a mode, skip auto-detect entirely
    if (forceMode) {
      setMode(forceMode)
      hasResolved.current = true
      return
    }

    if (!socket) return

    const handleClubConfig = (config: ClubConfig) => {
      if (hasResolved.current) return
      hasResolved.current = true
      setMode(config.configured === true ? 'club' : 'tournament')
    }

    socket.on(SocketEvents.SERVER.CLUB_CONFIG, handleClubConfig)
    socket.emit(SocketEvents.CLIENT.CLUB_GET_CONFIG)

    // Timeout fallback — assume tournament if no config arrives
    const timeout = setTimeout(() => {
      if (hasResolved.current) return
      hasResolved.current = true
      setMode('tournament')
    }, 5000)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_CONFIG, handleClubConfig)
      clearTimeout(timeout)
    }
  }, [socket, forceMode])

  if (mode === 'loading') {
    return (
      <div className="h-dvh bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted text-lg">Cargando...</span>
        </div>
      </div>
    )
  }

  if (mode === 'club') {
    return <ClubKioskPage />
  }

  return <KioskAllCourtsPage />
}
