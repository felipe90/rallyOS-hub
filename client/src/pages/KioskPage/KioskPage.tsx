import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSocketContext } from '@/contexts/SocketContext'
import { SocketEvents } from '@shared/events'
import type { ClubConfig } from '@shared/types'
import { KioskAllCourtsPage } from '@/pages/KioskAllCourtsPage'
import { ClubKioskPage } from '@/pages/ClubKioskPage'

type Mode = 'loading' | 'club' | 'tournament'

/**
 * KioskPage — auto-detect wrapper with URL override and remote kiosk mode switching.
 *
 * Route-based mode selection:
 * - /kiosk/club       → always club kiosk
 * - /kiosk/tournament → always tournament kiosk
 * - /kiosk            → uses KIOSK_MODE from server (switchable via SET_KIOSK_MODE from dashboards)
 *                       falls back to auto-detect (club if configured, else tournament)
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

    // Listen for remote kiosk mode from server (set by admin/owner dashboard)
    const handleKioskMode = (data: { mode: 'club' | 'tournament' }) => {
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

  return <KioskAllCourtsPage />
}
