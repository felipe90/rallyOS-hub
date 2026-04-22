/**
 * useSocketActions - Provides socket action emitters
 *
 * Single responsibility: emit socket events for actions.
 */

import { useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { TableInfo } from '@shared/types'
import { validateName } from './utils/socketValidation'

export function useSocketActions(socket: Socket | null, currentTable: TableInfo | null) {
  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socket?.connected) {
        socket.emit(event, data)
      }
    },
    [socket],
  )

  const createTable = useCallback(
    (name?: string) => {
      if (!validateName(name)) return
      emit(SocketEvents.CLIENT.CREATE_TABLE, { name })
    },
    [emit],
  )

  const requestTables = useCallback(() => emit(SocketEvents.CLIENT.LIST_TABLES), [emit])

  const requestTablesWithPins = useCallback(
    (ownerPin: string) => emit(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, { ownerPin }),
    [emit],
  )

  const scorePoint = useCallback(
    (player: 'A' | 'B') => {
      if (currentTable?.id) {
        emit(SocketEvents.CLIENT.RECORD_POINT, { tableId: currentTable.id, player })
      }
    },
    [emit, currentTable],
  )

  const undoLastPoint = useCallback(() => {
    if (currentTable?.id) {
      emit(SocketEvents.CLIENT.UNDO_LAST, { tableId: currentTable.id })
    }
  }, [emit, currentTable])

  const startMatch = useCallback(
    (config: {
      pointsPerSet: number
      bestOf: number
      playerNameA?: string
      playerNameB?: string
    } = { pointsPerSet: 15, bestOf: 3 }) => {
      if (currentTable?.id) {
        emit(SocketEvents.CLIENT.START_MATCH, { tableId: currentTable.id, ...config })
      }
    },
    [emit, currentTable],
  )

  const configureMatch = useCallback(
    (config: {
      tableId?: string
      playerNames?: { a: string; b: string }
      format?: number
      ptsPerSet?: number
      handicap?: { a: number; b: number }
    }) => {
      if (currentTable?.id) {
        emit(SocketEvents.CLIENT.CONFIGURE_MATCH, { tableId: currentTable.id, ...config })
      }
    },
    [emit, currentTable],
  )

  const regeneratePin = useCallback(
    (tableId: string) => {
      emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId })
    },
    [emit],
  )

  return {
    emit,
    createTable,
    requestTables,
    requestTablesWithPins,
    scorePoint,
    undoLastPoint,
    startMatch,
    configureMatch,
    regeneratePin,
  }
}
