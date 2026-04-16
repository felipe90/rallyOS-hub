/**
 * Referee authentication hook
 * Authenticates as referee when page loads (if user can edit).
 * Reads PIN from localStorage as fallback.
 */

import { useEffect } from 'react'
import { SocketEvents } from '@shared/events'
// emit type: (event: string, data?: unknown) => void

export function useRefAuth(
  emit: (event: string, data?: unknown) => void,
  tableId: string | undefined,
  connected: boolean,
  canEdit: boolean,
) {
  useEffect(() => {
    if (connected && tableId && canEdit) {
      const tablePin = localStorage.getItem('tablePin') || '12345'
      emit(SocketEvents.CLIENT.SET_REF, { tableId, pin: tablePin })
    }
  }, [tableId, connected, canEdit, emit])
}
