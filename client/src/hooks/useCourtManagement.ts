/**
 * useCourtManagement - Court lifecycle operations for the Owner dashboard
 *
 * Manages table creation, cleaning (PIN regeneration), and deletion.
 * Extracted from OwnerDashboardPage to keep the page focused on layout.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { validateCourtName } from '@/services/validation'

export interface CourtManagementConfig {
  socket: Socket | null
  connected: boolean
}

export function useCourtManagement({ socket, connected }: CourtManagementConfig) {
  /** ── Court Creation ── */
  const [isCreatingCourt, setIsCreatingCourt] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [courtName, setCourtName] = useState('')

  // Ref to avoid stale closures in callbacks
  const courtNameRef = useRef(courtName)
  const setCourtNameRef = useCallback((name: string) => {
    courtNameRef.current = name
    setCourtName(name)
  }, [])

  const startCreating = useCallback(() => {
    setIsCreatingCourt(true)
    setCourtNameRef('')
  }, [setCourtNameRef])

  const cancelCreating = useCallback(() => {
    setIsCreatingCourt(false)
    setIsCreating(false)
    setCourtNameRef('')
  }, [setCourtNameRef])

  const createCourt = useCallback(() => {
    const name = courtNameRef.current.trim() || undefined
    if (!validateCourtName(name)) return
    socket?.emit(SocketEvents.CLIENT.CREATE_COURT, { name })
    setIsCreating(true)
    // Name preserved so user can edit and retry on ERROR (SC-TC-02)
    // Name cleared in handleCourtCreated (happy path) and cancelCreating (cancel)
    // Do NOT setIsCreatingCourt(false) — waits for TABLE_CREATED or ERROR from server
  }, [socket, connected])

  // Defer closing the creation input until server responds
  useEffect(() => {
    if (!socket) return

    const handleCourtCreated = () => {
      setIsCreating(false)
      setIsCreatingCourt(false)
      setCourtName('')
    }

    const handleError = () => {
      setIsCreating(false)
      // Keep isCreatingCourt=true (input stays open)
      // Keep courtName (user can edit and retry)
    }

    socket.on(SocketEvents.SERVER.COURT_CREATED, handleCourtCreated)
    socket.on(SocketEvents.SERVER.ERROR, handleError)

    return () => {
      socket.off(SocketEvents.SERVER.COURT_CREATED, handleCourtCreated)
      socket.off(SocketEvents.SERVER.ERROR, handleError)
    }
  }, [socket])

  /** ── Court Cleaning (PIN Regeneration) ── */
  const [cleanConfirmCourtId, setCleanConfirmCourtId] = useState<string | null>(null)

  const requestClean = useCallback((courtId: string) => {
    setCleanConfirmCourtId(courtId)
  }, [])

  const confirmClean = useCallback(() => {
    if (cleanConfirmCourtId && socket && connected) {
      socket.emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId: cleanConfirmCourtId })
    }
    setCleanConfirmCourtId(null)
  }, [cleanConfirmCourtId, socket, connected])

  const cancelClean = useCallback(() => {
    setCleanConfirmCourtId(null)
  }, [])

  /** ── Court Deletion ── */
  const [deleteConfirmCourtId, setDeleteConfirmCourtId] = useState<string | null>(null)

  const requestDelete = useCallback((courtId: string) => {
    setDeleteConfirmCourtId(courtId)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deleteConfirmCourtId && socket && connected) {
      socket.emit(SocketEvents.CLIENT.DELETE_COURT, { tableId: deleteConfirmCourtId })
    }
    setDeleteConfirmCourtId(null)
  }, [deleteConfirmCourtId, socket, connected])

  const cancelDelete = useCallback(() => {
    setDeleteConfirmCourtId(null)
  }, [])

  return {
    // Creation
    isCreatingCourt,
    isCreating,
    courtName,
    setCourtName: setCourtNameRef,
    startCreating,
    cancelCreating,
    createCourt,
    // Cleaning
    cleanConfirmCourtId,
    requestClean,
    confirmClean,
    cancelClean,
    // Deletion
    deleteConfirmCourtId,
    requestDelete,
    confirmDelete,
    cancelDelete,
  }
}
