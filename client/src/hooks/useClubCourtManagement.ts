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

export type ClubOperationEvent = {
  type: 'court-created' | 'court-activated' | 'court-deactivated' | 'court-resetted' | 'session-ended' | 'court-deleted'
} | {
  type: 'error'
  code: string
}

export function useClubCourtManagement(socket: Socket | null, connected: boolean) {
  const [courts, setCourts] = useState<ClubCourtInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<ClubOperationEvent | null>(null)
  const [forceEndConfirmId, setForceEndConfirmId] = useState<string | null>(null)

  const clearEvent = useCallback(() => setLastEvent(null), [])

  // Listen for court lifecycle events from server
  useEffect(() => {
    if (!socket) return

    const handleCourtCreated = (court: ClubCourtInfo) => {
      setCourts(prev => [...prev, court])
      setLoading(false)
      setLastEvent({ type: 'court-created' })
    }

    const handleCourtActivated = (data: ClubCourtInfo) => {
      setCourts(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c))
      setLoading(false)
      setLastEvent({ type: 'court-activated' })
    }

    const handleCourtDeactivated = (data: { courtId: string; status: string }) => {
      setCourts(prev => prev.map(c =>
        c.id === data.courtId ? { ...c, status: 'AVAILABLE' as const, pin: undefined } : c
      ))
      setLoading(false)
      setLastEvent({ type: 'court-deactivated' })
    }

    const handleCourtResetted = (data: { courtId: string; status: string }) => {
      setCourts(prev => prev.map(c =>
        c.id === data.courtId ? { ...c, status: 'AVAILABLE' as const, pin: undefined } : c
      ))
      setLoading(false)
      setLastEvent({ type: 'court-resetted' })
    }

    const handleSessionEnded = (data: { courtId: string }) => {
      setCourts(prev => prev.map(c =>
        c.id === data.courtId ? { ...c, status: 'FINISHED' as const, pin: undefined } : c
      ))
      setLoading(false)
      setLastEvent({ type: 'session-ended' })
    }

    const handleCourtDeleted = (data: { courtId: string }) => {
      setCourts(prev => prev.filter(c => c.id !== data.courtId))
      setLoading(false)
      setLastEvent({ type: 'court-deleted' })
    }

    const handleError = (err: { code: string; message: string }) => {
      setError(err.code || 'UNKNOWN_ERROR')
      setLoading(false)
      setLastEvent({ type: 'error', code: err.code || 'UNKNOWN_ERROR' })
    }

    // Listen for COURT_LIST to sync club court status changes
    // COURT_UPDATE only goes to court room members; COURT_LIST is global.
    // Club courts in COURT_LIST carry clubStatus in the status field.
    const handleCourtList = (courtsList: Array<{ id: string; status: string; mode?: string }>) => {
      const clubCourts = courtsList.filter(c => c.mode === 'club')
      if (clubCourts.length > 0) {
        setCourts(prev => {
          const updated = [...prev]
          for (const cc of clubCourts) {
            const idx = updated.findIndex(c => c.id === cc.id)
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], status: cc.status as ClubCourtInfo['status'] }
            }
          }
          return updated
        })
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_COURT_CREATED, handleCourtCreated)
    socket.on(SocketEvents.SERVER.CLUB_COURT_ACTIVATED, handleCourtActivated)
    socket.on(SocketEvents.SERVER.CLUB_COURT_DEACTIVATED, handleCourtDeactivated)
    socket.on(SocketEvents.SERVER.CLUB_COURT_RESETTED, handleCourtResetted)
    socket.on(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)
    socket.on(SocketEvents.SERVER.COURT_DELETED, handleCourtDeleted)
    socket.on(SocketEvents.SERVER.COURT_LIST, handleCourtList)
    socket.on(SocketEvents.SERVER.ERROR, handleError)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_COURT_CREATED, handleCourtCreated)
      socket.off(SocketEvents.SERVER.CLUB_COURT_ACTIVATED, handleCourtActivated)
      socket.off(SocketEvents.SERVER.CLUB_COURT_DEACTIVATED, handleCourtDeactivated)
      socket.off(SocketEvents.SERVER.CLUB_COURT_RESETTED, handleCourtResetted)
      socket.off(SocketEvents.SERVER.CLUB_SESSION_ENDED, handleSessionEnded)
      socket.off(SocketEvents.SERVER.COURT_DELETED, handleCourtDeleted)
      socket.off(SocketEvents.SERVER.COURT_LIST, handleCourtList)
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

  const deactivateCourt = useCallback((courtId: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit(SocketEvents.CLIENT.CLUB_DEACTIVATE_COURT, { courtId })
  }, [socket, connected])

  const resetCourt = useCallback((courtId: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    socket.emit(SocketEvents.CLIENT.CLUB_RESET_COURT, { courtId })
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
    lastEvent,
    forceEndConfirmId,
    createCourt,
    activateCourt,
    deactivateCourt,
    resetCourt,
    forceEndSession,
    deleteCourt,
    requestForceEnd,
    cancelForceEnd,
    clearError,
    clearEvent,
  }
}
