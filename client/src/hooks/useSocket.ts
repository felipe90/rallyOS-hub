/**
 * useSocket Hook - Centralized socket management
 *
 * This hook is now a thin wrapper that composes three focused hooks:
 * - useSocketConnection: manages connection lifecycle
 * - useSocketState: manages table/match state from events
 * - useSocketActions: provides action emitters
 *
 * @deprecated Consider using the focused hooks directly for new code.
 */

import { useEffect } from 'react'
import { useSocketConnection } from './useSocketConnection'
import { useSocketState } from './useSocketState'
import { useSocketActions } from './useSocketActions'

export interface UseSocketOptions {
  serverUrl?: string
  autoConnect?: boolean
}

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
  errorCode: string | null
}

export function useSocket(options: UseSocketOptions = {}) {
  const { serverUrl, autoConnect = true } = options

  const { socketRef, connected, connecting, error, errorCode, connect, disconnect } =
    useSocketConnection(serverUrl)

  const { tables, currentMatch, currentTable } = useSocketState(socketRef.current)

  const actions = useSocketActions(socketRef.current, currentTable)

  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    socket: socketRef.current,
    connected,
    connecting,
    error,
    errorCode,
    tables,
    currentTable,
    currentMatch,
    connect,
    disconnect,
    ...actions,
  }
}
