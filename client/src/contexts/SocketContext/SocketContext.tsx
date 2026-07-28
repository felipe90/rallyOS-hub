import React, { createContext, ReactNode, useEffect, useRef } from 'react'
import { useSocket as useSocketHook } from '../../hooks/useSocket'
import { useAuthContext } from '../AuthContext'

export type SocketContextType = ReturnType<typeof useSocketHook>

export const SocketContext = createContext<SocketContextType | undefined>(undefined)

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socket = useSocketHook({ autoConnect: true })
  const { logout, role } = useAuthContext()
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
