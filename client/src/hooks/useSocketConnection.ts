/**
 * useSocketConnection - Manages socket.io connection lifecycle
 *
 * Single responsibility: connect, disconnect, track connection state.
 */

import { useCallback, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export interface SocketConnectionState {
  connected: boolean
  connecting: boolean
  error: string | null
  errorCode: string | null
}

function getDefaultServerUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL
  }

  if (typeof window !== 'undefined') {
    const loc = window.location
    const isDev = loc.port === '5173'
    return isDev ? 'https://localhost:3000' : loc.origin
  }

  return 'https://localhost:3000'
}

export function useSocketConnection(serverUrl: string = getDefaultServerUrl()) {
  const socketRef = useRef<Socket | null>(null)
  const [state, setState] = useState<SocketConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    errorCode: null,
  })

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    setState(s => ({ ...s, connecting: true, error: null }))

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => {
      setState({ connected: true, connecting: false, error: null, errorCode: null })
    })

    socket.on('disconnect', () => {
      setState(s => ({ ...s, connected: false }))
    })

    socket.on('connect_error', (error: Error) => {
      const isServerDown =
        error.message.includes('Connection refused') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('net::ERR_CONNECTION_REFUSED') ||
        error.message.includes('timeout')

      const friendlyMessage = isServerDown
        ? 'Servidor no disponible. Verificá la red.'
        : error.message

      setState({
        connected: false,
        connecting: false,
        error: friendlyMessage,
        errorCode: null,
      })
    })

    socketRef.current = socket
  }, [serverUrl])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setState({ connected: false, connecting: false, error: null, errorCode: null })
    }
  }, [])

  return {
    socketRef,
    ...state,
    connect,
    disconnect,
  }
}
