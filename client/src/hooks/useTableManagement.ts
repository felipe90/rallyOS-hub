/**
 * useTableManagement - Table lifecycle operations for the Owner dashboard
 *
 * Manages table creation, cleaning (PIN regeneration), and deletion.
 * Extracted from OwnerDashboardPage to keep the page focused on layout.
 */

import { useState, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { validateTableName } from '@/services/validation'

export interface TableManagementConfig {
  socket: Socket | null
  connected: boolean
}

export function useTableManagement({ socket, connected }: TableManagementConfig) {
  /** ── Table Creation ── */
  const [isCreatingTable, setIsCreatingTable] = useState(false)
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
    setTableNameRef('')
  }, [setTableNameRef])

  const createTable = useCallback(() => {
    const name = tableNameRef.current.trim() || undefined
    if (!validateTableName(name)) return
    socket?.emit(SocketEvents.CLIENT.CREATE_TABLE, { name })
    setTableNameRef('')
    setIsCreatingTable(false)
  }, [socket, connected, setTableNameRef])

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
