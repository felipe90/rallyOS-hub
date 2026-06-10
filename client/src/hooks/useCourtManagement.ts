/**
 * useCourtManagement - Court lifecycle operations for the Owner dashboard
 *
 * Manages table creation, cleaning (PIN regeneration), and deletion.
 * Extracted from OwnerDashboardPage to keep the page focused on layout.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { validateTableName } from '@/services/validation'

export interface TableManagementConfig {
  socket: Socket | null
  connected: boolean
}

export function useCourtManagement({ socket, connected }: TableManagementConfig) {
  /** ── Table Creation ── */
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [tableName, setTableName] = useState('')

  // Ref to avoid stale closures in callbacks
  const tableNameRef = useRef(tableName)
  const setTableNameRef = useCallback((name: string) => {
    tableNameRef.current = name
    setTableName(name)
  }, [])

  const startCreating = useCallback(() => {
    setIsCreatingTable(true)
    setTableNameRef('')
  }, [setTableNameRef])

  const cancelCreating = useCallback(() => {
    setIsCreatingTable(false)
    setIsCreating(false)
    setTableNameRef('')
  }, [setTableNameRef])

  const createTable = useCallback(() => {
    const name = tableNameRef.current.trim() || undefined
    if (!validateTableName(name)) return
    socket?.emit(SocketEvents.CLIENT.CREATE_TABLE, { name })
    setIsCreating(true)
    // Name preserved so user can edit and retry on ERROR (SC-TC-02)
    // Name cleared in handleTableCreated (happy path) and cancelCreating (cancel)
    // Do NOT setIsCreatingTable(false) — waits for TABLE_CREATED or ERROR from server
  }, [socket, connected])

  // Defer closing the creation input until server responds
  useEffect(() => {
    if (!socket) return

    const handleTableCreated = () => {
      setIsCreating(false)
      setIsCreatingTable(false)
      setTableName('')
    }

    const handleError = () => {
      setIsCreating(false)
      // Keep isCreatingTable=true (input stays open)
      // Keep tableName (user can edit and retry)
    }

    socket.on(SocketEvents.SERVER.TABLE_CREATED, handleTableCreated)
    socket.on(SocketEvents.SERVER.ERROR, handleError)

    return () => {
      socket.off(SocketEvents.SERVER.TABLE_CREATED, handleTableCreated)
      socket.off(SocketEvents.SERVER.ERROR, handleError)
    }
  }, [socket])

  /** ── Table Cleaning (PIN Regeneration) ── */
  const [cleanConfirmTableId, setCleanConfirmTableId] = useState<string | null>(null)

  const requestClean = useCallback((tableId: string) => {
    setCleanConfirmTableId(tableId)
  }, [])

  const confirmClean = useCallback(() => {
    if (cleanConfirmTableId && socket && connected) {
      socket.emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId: cleanConfirmTableId })
    }
    setCleanConfirmTableId(null)
  }, [cleanConfirmTableId, socket, connected])

  const cancelClean = useCallback(() => {
    setCleanConfirmTableId(null)
  }, [])

  /** ── Table Deletion ── */
  const [deleteConfirmTableId, setDeleteConfirmTableId] = useState<string | null>(null)

  const requestDelete = useCallback((tableId: string) => {
    setDeleteConfirmTableId(tableId)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deleteConfirmTableId && socket && connected) {
      socket.emit(SocketEvents.CLIENT.DELETE_TABLE, { tableId: deleteConfirmTableId })
    }
    setDeleteConfirmTableId(null)
  }, [deleteConfirmTableId, socket, connected])

  const cancelDelete = useCallback(() => {
    setDeleteConfirmTableId(null)
  }, [])

  return {
    // Creation
    isCreatingTable,
    isCreating,
    tableName,
    setTableName: setTableNameRef,
    startCreating,
    cancelCreating,
    createTable,
    // Cleaning
    cleanConfirmTableId,
    requestClean,
    confirmClean,
    cancelClean,
    // Deletion
    deleteConfirmTableId,
    requestDelete,
    confirmDelete,
    cancelDelete,
  }
}
