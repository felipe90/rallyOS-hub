/**
 * RefRevoked state hook
 * Listens for REF_REVOKED socket event and triggers navigation after timeout.
 */

import { useEffect, useState } from 'react'
import type { RefRevokedEvent } from '@shared/types'
import { Routes } from '@/routes'

interface UseRefRevokedProps {
  socket: ReturnType<typeof import('@/contexts/SocketContext').useSocketContext>['socket']
  tableId: string
  navigate: (path: string) => void
}

export function useRefRevoked({ socket, tableId, navigate }: UseRefRevokedProps) {
  const [refRevoked, setRefRevoked] = useState(false)

  useEffect(() => {
    if (!socket) return
    const handler = (data: RefRevokedEvent) => {
      if (data.tableId === tableId) {
        setRefRevoked(true)
        setTimeout(() => navigate(Routes.DASHBOARD_SPECTATOR), 3000)
      }
    }
    socket.on('REF_REVOKED', handler)
    return () => { socket.off('REF_REVOKED', handler) }
  }, [socket, tableId, navigate])

  return refRevoked
}
