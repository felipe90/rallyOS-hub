import React, { createContext, ReactNode } from 'react'
import { useSocket as useSocketHook } from '../../hooks/useSocket'

export type SocketContextType = ReturnType<typeof useSocketHook>

export const SocketContext = createContext<SocketContextType | undefined>(undefined)

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socket = useSocketHook({ autoConnect: true })

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
