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

import { useEffect, useMemo } from 'react'
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

  const { courts, currentMatch, currentCourt, appError, allHistories, hubConfig, kioskNotification, bracket } = useSocketState(socketRef.current)

  const actions = useSocketActions(socketRef.current, currentCourt)

  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // Referentially stable unless an actual dependency changes. Without this,
  // every provider/consumer render produces a fresh object, so a single
  // `COURT_UPDATE` broadcast would re-render the whole tree below the provider.
  return useMemo(
    () => ({
      socket: socketRef.current,
      connected,
      connecting,
      error,
      errorCode,
      appError,
      courts,
      currentCourt,
      currentMatch,
      allHistories,
      hubConfig,
      kioskNotification,
      bracket,
      connect,
      disconnect,
      ...actions,
    }),
    [
      socketRef.current,
      connected,
      connecting,
      error,
      errorCode,
      appError,
      courts,
      currentCourt,
      currentMatch,
      allHistories,
      hubConfig,
      kioskNotification,
      bracket,
      connect,
      disconnect,
      actions.emit,
      actions.requestCourts,
      actions.requestCourtsWithPins,
      actions.scorePoint,
      actions.undoLastPoint,
      actions.startMatch,
      actions.regeneratePin,
    ],
  )
}
