/**
 * useClubCourtManagement - Club court lifecycle hook
 *
 * Manages club court CRUD, activation, and force-end operations.
 * Delegates socket I/O — no business logic.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { ClubCourtInfo } from '@shared/types'

export function useClubCourtManagement(socket: Socket | null, connected: boolean) {
  const [courts, setCourts] = useState<ClubCourtInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceEndConfirmId, setForceEndConfirmId] = useState<string | null>(null)

  // Listen for court lifecycle events from server
  useEffect(() => {
    if (!socket) return

    const handleCourtCreated = (court: ClubCourtInfo) => {
      setCourts(prev => [...prev, court])
      setLoading(false)
    }

    const handleCourtActivated = (data: ClubCourtInfo) => {
      setCourts(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c))
      setLoading(false)
    }

    const handleSessionEnded = (data: { courtId: string }) => {
      setCourts(prev => prev.map(c =>
        c.id === data.courtId ? { ...c, status: 'FINISHED' as const, pin: undefined } : c
      ))
      setLoading(false)
    }

    const handleCourtDeleted = (data: { courtId: string }) => {
      setCourts(prev => prev.filter(c => c.id !== data.courtId))
      setLoading(false)
    }

    const handleError = (err: { code: string; message: string }) => {
      setError(err.code || 'UNKNOWN_ERROR')
      setLoading(false)
    }

    socket.on(SocketEvents.SERVER.CLUB_COURT_CREATED, handleCourtCreated)
    socket.on(SocketEvents.SERVER.CLUB_COURT_ACTIVATED, handleCourtActivated)
    socket.on(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)
    socket.on(SocketEvents.SERVER.COURT_DELETED, handleCourtDeleted)
    socket.on(SocketEvents.SERVER.ERROR, handleError)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_COURT_CREATED, handleCourtCreated)
      socket.off(SocketEvents.SERVER.CLUB_COURT_ACTIVATED, handleCourtActivated)
      socket.off(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)
      socket.off(SocketEvents.SERVER.COURT_DELETED, handleCourtDeleted)
      socket.off(SocketEvents.SERVER.ERROR, handleError)
    }
  }, [socket])

  const createCourt = useCallback((name: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit(SocketEvents.CLIENT.CLUB_CREATE_COURT, { name })
  }, [socket, connected])

  const activateCourt = useCallback((courtId: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit(SocketEvents.CLIENT.CLUB_ACTIVATE_COURT, { courtId })
  }, [socket, connected])

  const forceEndSession = useCallback((courtId: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    setForceEndConfirmId(null)
    socket.emit(SocketEvents.CLIENT.CLUB_FORCE_END, { courtId })
  }, [socket, connected])

  const deleteCourt = useCallback((courtId: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit(SocketEvents.CLIENT.CLUB_DELETE_COURT, { courtId })
  }, [socket, connected])

  const requestForceEnd = useCallback((courtId: string) => setForceEndConfirmId(courtId), [])
  const cancelForceEnd = useCallback(() => setForceEndConfirmId(null), [])
  const clearError = useCallback(() => setError(null), [])

  return {
    courts,
    loading,
    error,
    forceEndConfirmId,
    createCourt,
    activateCourt,
    forceEndSession,
    deleteCourt,
    requestForceEnd,
    cancelForceEnd,
    clearError,
  }
}
