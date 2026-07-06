import { useEffect, useRef, useState } from 'react'
import { useSocketContext } from '@/contexts/SocketContext'
import { SocketEvents } from '@shared/events'
import type { ClubConfig } from '@shared/types'
import { KioskAllCourtsPage } from '@/pages/KioskAllCourtsPage'
import { ClubKioskPage } from '@/pages/ClubKioskPage'

type Mode = 'loading' | 'club' | 'tournament'

/**
 * KioskPage — auto-detect wrapper
 *
 * On mount, emits CLUB_GET_CONFIG to determine hub type.
 * - Club hub (configured === true) → renders ClubKioskPage
 * - Tournament hub → renders KioskAllCourtsPage (unchanged behavior)
 * Falls back to tournament kiosk after 5s timeout.
 */
export function KioskPage() {
  const { socket } = useSocketContext()
  const [mode, setMode] = useState<Mode>('loading')
  const hasResolved = useRef(false)

  useEffect(() => {
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
  }, [socket])

  if (mode === 'loading') {
    return (
      <div className="h-dvh bg-surface flex items-center justify-center">
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
