/**
 * Match state hook
 * Requests match data from server when component mounts or tableId changes.
 */

import { useEffect } from 'react'
import { SocketEvents } from '@shared/events'
// emit type: (event: string, data?: unknown) => void

export function useMatchState(
  emit: (event: string, data?: unknown) => void,
  tableId: string | undefined,
  connected: boolean,
) {
  useEffect(() => {
    if (connected && tableId) {
      emit(SocketEvents.CLIENT.GET_MATCH_STATE, { tableId })
    }
  }, [tableId, connected, emit])
}
