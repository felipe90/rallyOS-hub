import React, { createContext, ReactNode, useEffect, useRef } from 'react'
import { useSocket as useSocketHook } from '../../hooks/useSocket'
import { useAuthContext } from '../AuthContext'
import { SocketEvents } from '@shared/events'
import { UserRoles } from '../AuthContext/AuthContext.types'

export type SocketContextType = ReturnType<typeof useSocketHook>

export const SocketContext = createContext<SocketContextType | undefined>(undefined)

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socket = useSocketHook({ autoConnect: true })
  const { logout, role, ownerPin } = useAuthContext()
  const prevConnected = useRef(false)

  // When socket disconnects while a user is authenticated, log them out
  // so PrivateRoute redirects to /auth (matching admin behavior where
  // useClubAdmin resets isAdmin on disconnect).
  useEffect(() => {
    if (prevConnected.current && !socket.connected && role) {
      logout()
    }
    prevConnected.current = socket.connected
  }, [socket.connected, role, logout])

  // Re-verify the owner on reconnect: a fresh socket does not inherit the
  // server-side `isOwner` flag, so owner-gated events (BRACKET_*, REGENERATE_PIN)
  // would silently fail until the user re-authenticates. The PIN lives in
  // memory only (never persisted), so this is safe: it only re-uses the PIN
  // the user already entered this session. Runs on every connect transition
  // (initial connect included — harmless duplicate of the login flow).
  const ownerPinRef = useRef(ownerPin)
  useEffect(() => {
    ownerPinRef.current = ownerPin
  }, [ownerPin])
  useEffect(() => {
    if (socket.connected && role === UserRoles.OWNER && ownerPinRef.current) {
      socket.emit(SocketEvents.CLIENT.VERIFY_OWNER, { pin: ownerPinRef.current })
    }
  }, [socket, socket.connected, role])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext(): SocketContextType {
  const context = React.useContext(SocketContext)
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider')
  }
  return context
}
