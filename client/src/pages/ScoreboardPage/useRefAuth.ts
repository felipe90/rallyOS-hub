/**
 * Referee authentication hook
 * Authenticates as referee when page loads (if user can edit).
 * Requires a valid tablePin — never defaults to a known PIN.
 */

import { useEffect } from 'react'
import { SocketEvents } from '@shared/events'
// emit type: (event: string, data?: unknown) => void

export function useRefAuth(
  emit: (event: string, data?: unknown) => void,
  tableId: string | undefined,
  connected: boolean,
  canEdit: boolean,
  tablePin: string | null,
) {
  useEffect(() => {
    if (connected && tableId && canEdit && tablePin) {
      emit(SocketEvents.CLIENT.SET_REF, { tableId, pin: tablePin })
    }
  }, [tableId, connected, canEdit, tablePin, emit])
}
