import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { AuthContextValue, UserRole } from './AuthContext.types'
import { UserRoles } from './AuthContext.types'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [ownerPin, setOwnerPin] = useState<string | null>(null)
  const [tablePin, setTablePinState] = useState<string | null>(null)

  const login = useCallback((newRole: UserRole, tId?: string, pin?: string) => {
    if (newRole) {
      setRole(newRole)
    }
    if (tId) {
      setTableId(tId)
    }
    if (pin) {
      setOwnerPin(pin)
    }
  }, [])

  const logout = useCallback(() => {
    setRole(null)
    setTableId(null)
    setOwnerPin(null)
    setTablePinState(null)
  }, [])

  const setOwner = useCallback((isOwner: boolean, pin?: string) => {
    if (isOwner) {
      setRole(UserRoles.OWNER)
      if (pin) {
        setOwnerPin(pin)
      }
    }
  }, [])

  const setTablePin = useCallback((pin: string) => {
    // PIN stored in memory only — never persisted to browser storage
    setTablePinState(pin)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    role,
    tableId,
    ownerPin,
    tablePin,
    isOwner: role === UserRoles.OWNER,
    isReferee: role === UserRoles.REFEREE,
    isViewer: role === UserRoles.VIEWER,
    isAuthenticated: !!role,
    login,
    logout,
    setOwner,
    setTablePin,
  }), [role, tableId, ownerPin, tablePin, login, logout, setOwner, setTablePin])

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