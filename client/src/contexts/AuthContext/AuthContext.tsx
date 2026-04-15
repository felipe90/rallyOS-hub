import React, { createContext, useContext, useState, useEffect } from 'react'
import type { AuthContextValue, UserRole } from './AuthContext.types'
import { UserRoles } from './AuthContext.types'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('role') as UserRole
    }
    return null
  })
  
  const [tableId, setTableId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tableId') || null
    }
    return null
  })
  
  const [ownerPin, setOwnerPin] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ownerPin') || null
    }
    return null
  })

  const [tablePin, setTablePinState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tablePin') || null
    }
    return null
  })

  const login = (newRole: UserRole, tId?: string, pin?: string) => {
    if (newRole) {
      localStorage.setItem('role', newRole)
      setRole(newRole)
    }
    if (tId) {
      localStorage.setItem('tableId', tId)
      setTableId(tId)
    }
    if (pin) {
      localStorage.setItem('ownerPin', pin)
      setOwnerPin(pin)
    }
  }

  const logout = () => {
    localStorage.removeItem('role')
    localStorage.removeItem('tableId')
    localStorage.removeItem('ownerPin')
    localStorage.removeItem('tablePin')
    setRole(null)
    setTableId(null)
    setOwnerPin(null)
    setTablePinState(null)
  }

  const setOwner = (isOwner: boolean, pin?: string) => {
    if (isOwner) {
      localStorage.setItem('role', UserRoles.OWNER)
      setRole(UserRoles.OWNER)
      if (pin) {
        localStorage.setItem('ownerPin', pin)
        setOwnerPin(pin)
      }
    }
  }

  const setTablePin = (pin: string) => {
    localStorage.setItem('tablePin', pin)
    setTablePinState(pin)
  }

  const value: AuthContextValue = {
    role,
    tableId,
    ownerPin,
    isOwner: role === UserRoles.OWNER,
    isReferee: role === UserRoles.REFEREE,
    isViewer: role === UserRoles.VIEWER,
    isAuthenticated: !!role,
    login,
    logout,
    setOwner,
    setTablePin,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}