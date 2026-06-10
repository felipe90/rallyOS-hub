/**
 * useSocketActions - Provides socket action emitters
 *
 * Single responsibility: emit socket events for actions.
 */

import { useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { TableInfo } from '@shared/types'
import { validateCourtName } from '@/services/validation'

export function useSocketActions(socket: Socket | null, currentCourt: TableInfo | null) {
  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socket?.connected) {
        socket.emit(event, data)
      }
    },
    [socket],
  )

  const createCourt = useCallback(
    (name?: string) => {
      if (!validateCourtName(name)) return
      emit(SocketEvents.CLIENT.CREATE_COURT, { name })
    },
    [emit],
  )

  const requestCourts = useCallback(() => emit(SocketEvents.CLIENT.LIST_COURTS), [emit])

  const requestCourtsWithPins = useCallback(
    (ownerPin: string) => emit(SocketEvents.CLIENT.GET_COURTS_WITH_PINS, { ownerPin }),
    [emit],
  )

  const scorePoint = useCallback(
    (player: 'A' | 'B') => {
      if (currentCourt?.id) {
        emit(SocketEvents.CLIENT.RECORD_POINT, { tableId: currentCourt.id, player })
      }
    },
    [emit, currentCourt],
  )

  const undoLastPoint = useCallback(() => {
    if (currentCourt?.id) {
      emit(SocketEvents.CLIENT.UNDO_LAST, { tableId: currentCourt.id })
    }
  }, [emit, currentCourt])

  const startMatch = useCallback(
    (config: {
      pointsPerSet: number
      bestOf: number
      playerNameA?: string
      playerNameB?: string
    } = { pointsPerSet: 15, bestOf: 3 }) => {
      if (currentCourt?.id) {
        emit(SocketEvents.CLIENT.START_MATCH, { tableId: currentCourt.id, ...config })
      }
    },
    [emit, currentCourt],
  )

  const regeneratePin = useCallback(
    (courtId: string) => {
      emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId: courtId })
    },
    [emit],
  )

  return {
    emit,
    createCourt,
    requestCourts,
    requestCourtsWithPins,
    scorePoint,
    undoLastPoint,
    startMatch,
    regeneratePin,
  }
}
