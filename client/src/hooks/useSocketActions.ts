/**
 * useSocketActions - Provides socket action emitters
 *
 * Single responsibility: emit socket events for actions.
 */

import { useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { CourtInfo } from '@shared/types'

export function useSocketActions(socket: Socket | null, currentCourt: CourtInfo | null) {
  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socket?.connected) {
        socket.emit(event, data)
      }
    },
    [socket],
  )

  // NOTE (admin-court-inventory slice 5): createCourt removed — court
  // existence is admin-only via the INVENTORY_* events (useCourtInventory).

  const requestCourts = useCallback(() => emit(SocketEvents.CLIENT.LIST_COURTS), [emit])

  const requestCourtsWithPins = useCallback(
    (ownerPin: string) => emit(SocketEvents.CLIENT.GET_COURTS_WITH_PINS, { ownerPin }),
    [emit],
  )

  const scorePoint = useCallback(
    (player: 'A' | 'B') => {
      if (currentCourt?.id) {
        emit(SocketEvents.CLIENT.RECORD_POINT, { courtId: currentCourt.id, player })
      }
    },
    [emit, currentCourt],
  )

  const undoLastPoint = useCallback(() => {
    if (currentCourt?.id) {
      emit(SocketEvents.CLIENT.UNDO_LAST, { courtId: currentCourt.id })
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
        emit(SocketEvents.CLIENT.START_MATCH, { courtId: currentCourt.id, ...config })
      }
    },
    [emit, currentCourt],
  )

  const regeneratePin = useCallback(
    (courtId: string) => {
      emit(SocketEvents.CLIENT.REGENERATE_PIN, { courtId: courtId })
    },
    [emit],
  )

  return {
    emit,
    requestCourts,
    requestCourtsWithPins,
    scorePoint,
    undoLastPoint,
    startMatch,
    regeneratePin,
  }
}
