import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSocketContext } from '@/contexts/SocketContext'
import { SocketEvents } from '@shared/events'
import type { ClubConfig, KioskMode } from '@shared/types'
import { KioskAllCourtsPage } from '@/pages/KioskAllCourtsPage'
import { ClubKioskPage } from '@/pages/ClubKioskPage'
import { KioskBracketPage } from '@/pages/KioskBracketPage'

type Mode = 'loading' | 'club' | 'tournament' | 'bracket'

/**
 * KioskPage — auto-detect wrapper with URL override and remote kiosk mode switching.
 *
 * Route-based mode selection:
 * - /kiosk/club       → always club kiosk
 * - /kiosk/tournament → always tournament kiosk
 * - /kiosk            → uses KIOSK_MODE from server (switchable via SET_KIOSK_MODE from dashboards)
 *                       falls back to auto-detect (club if configured, else tournament)
 *
 * The 'bracket' mode has no URL override — it is only reachable via the remote
 * KIOSK_MODE push (owner dashboard toggles the kiosk to the live bracket view).
 */
export function KioskPage() {
  const { socket } = useSocketContext()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('loading')
  const hasResolved = useRef(false)

  // URL-based mode override — bypasses auto-detect and remote mode
  const forceMode = location.pathname.includes('/kiosk/club') ? 'club'
    : location.pathname.includes('/kiosk/tournament') || location.pathname.includes('/scoreboard/all/kiosk') ? 'tournament'
    : null

  useEffect(() => {
    // If URL forces a mode, skip everything else
    if (forceMode) {
      setMode(forceMode)
      hasResolved.current = true
      return
    }

    if (!socket) return

    // Request the current kiosk mode on (re)mount: the server pushes
    // KIOSK_MODE once at connection time, but a page reload can attach this
    // listener AFTER that one-shot emit — without the request the TV kiosk
    // would stay on the loading spinner forever. GET_KIOSK_MODE returns the
    // current mode on demand (same race pattern as LIST_COURTS etc.).
    socket.emit(SocketEvents.CLIENT.GET_KIOSK_MODE)

    // Listen for remote kiosk mode from server (set by admin/owner dashboard)
    const handleKioskMode = (data: { mode: KioskMode }) => {
      setMode(data.mode)
      hasResolved.current = true
    }

    socket.on(SocketEvents.SERVER.KIOSK_MODE, handleKioskMode)

    return () => {
      socket.off(SocketEvents.SERVER.KIOSK_MODE, handleKioskMode)
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

  if (mode === 'bracket') {
    return <KioskBracketPage />
  }

  return <KioskAllCourtsPage />
}
