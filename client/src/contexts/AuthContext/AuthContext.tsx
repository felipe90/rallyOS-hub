import React, { createContext, useContext, useState } from 'react'
import type { AuthContextValue, UserRole } from './AuthContext.types'
import { UserRoles } from './AuthContext.types'
import { authStorage } from '@/services/storage'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => authStorage.getRole())
  const [tableId, setTableId] = useState<string | null>(() => authStorage.getTableId())
  const [ownerPin, setOwnerPin] = useState<string | null>(() => authStorage.getOwnerPin())
  const [tablePin, setTablePinState] = useState<string | null>(null)

  const login = (newRole: UserRole, tId?: string, pin?: string) => {
    if (newRole) {
      authStorage.setRole(newRole)
      setRole(newRole)
    }
    if (tId) {
      authStorage.setTableId(tId)
      setTableId(tId)
    }
    if (pin) {
      authStorage.setOwnerPin(pin)
      setOwnerPin(pin)
    }
  }

  const logout = () => {
    authStorage.clear()
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
        sessionStorage.setItem('ownerPin', pin)
        setOwnerPin(pin)
      }
    }
  }

  const setTablePin = (pin: string) => {
    // PIN stored in memory only — never persisted to browser storage
    setTablePinState(pin)
  }

  const value: AuthContextValue = {
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