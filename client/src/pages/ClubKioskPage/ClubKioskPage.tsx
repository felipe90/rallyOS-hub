import { useEffect, useState } from 'react'
import { useSocketContext } from '@/contexts/SocketContext'
import { useI18n } from '@/i18n'
import { ConnectionStatus, Typography } from '@/components/atoms'
import { ClubKioskCard } from '@/components/organisms/ClubKioskCard'
import { SocketEvents } from '@shared/events'
import type { ClubKioskPayload } from '@shared/types'

/**
 * ClubKioskPage — staff-facing kiosk for club-mode hubs.
 *
 * Subscribes to CLUB_KIOSK_DATA for live updates and renders
 * a responsive grid of ClubKioskCard components.
 */
export function ClubKioskPage() {
  const { socket, connected, connecting } = useSocketContext()
  const { i18nText } = useI18n()
  const [courts, setCourts] = useState<ClubKioskPayload['courts']>([])
  const [clubName, setClubName] = useState('Club')

  useEffect(() => {
    if (!socket) return

    const handleKioskData = (payload: ClubKioskPayload) => {
      setCourts(payload.courts)
      setClubName(payload.clubName)
    }

    socket.on(SocketEvents.SERVER.CLUB_KIOSK_DATA, handleKioskData)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_KIOSK_DATA, handleKioskData)
    }
  }, [socket])

  return (
    <div className="h-dvh bg-surface flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <Typography variant="title" className="text-2xl font-bold">
          {clubName}
        </Typography>
        <ConnectionStatus
          labels={{
            connected: 'Conectado',
            connecting: 'Conectando',
            error: 'Sin Conexión',
            disconnected: 'Desconectado',
          }}
        />
      </div>

      {/* Empty state */}
      {courts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Typography variant="title" className="text-xl text-text-muted text-center px-4">
            {i18nText('clubKioskNoCourts')}
          </Typography>
        </div>
      ) : (
        /* Responsive grid */
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 content-start overflow-y-auto">
          {courts.map((court) => (
            <ClubKioskCard key={court.id} court={court} />
          ))}
        </div>
      )}
    </div>
  )
}
