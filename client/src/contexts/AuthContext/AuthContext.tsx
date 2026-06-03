import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { AuthContextValue, UserRole } from './AuthContext.types'
import { UserRoles } from './AuthContext.types'
import { authStorage } from '@/services/storage/authStorage'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [ownerPin, setOwnerPin] = useState<string | null>(null)
  const [tablePin, setTablePinState] = useState<string | null>(null)
  const [tournamentToken, setTournamentTokenState] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)

  // Restore auth state from storage on mount
  useEffect(() => {
    const savedRole = authStorage.getRole()
    if (savedRole) {
      setRole(savedRole)
      setTableId(authStorage.getTableId())
      setTournamentTokenState(authStorage.getTournamentToken())
      // ownerPin and tablePin are NOT restored from storage (security)
    }
    setIsRestoring(false)
  }, [])

  const login = useCallback((newRole: UserRole, tId?: string, pin?: string) => {
    if (newRole) {
      setRole(newRole)
      authStorage.setRole(newRole)
    }
    if (tId) {
      setTableId(tId)
      authStorage.setTableId(tId)
    }
    if (pin) {
      setOwnerPin(pin)
      // PIN is NOT persisted to storage (security)
    }
  }, [])

  const logout = useCallback(() => {
    setRole(null)
    setTableId(null)
    setOwnerPin(null)
    setTablePinState(null)
    setTournamentTokenState(null)
    authStorage.clear()
  }, [])

  const setOwner = useCallback((isOwner: boolean, pin?: string) => {
    if (isOwner) {
      setRole(UserRoles.OWNER)
      authStorage.setRole(UserRoles.OWNER)
      if (pin) {
        setOwnerPin(pin)
        // PIN is NOT persisted to storage (security)
      }
    }
  }, [])

  const setTablePin = useCallback((pin: string) => {
    // PIN stored in memory only — never persisted to browser storage
    setTablePinState(pin)
  }, [])

  const setTournamentToken = useCallback((token: string) => {
    setTournamentTokenState(token)
    authStorage.setTournamentToken(token)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    role,
    tableId,
    ownerPin,
    tablePin,
    tournamentToken,
    isRestoring,
    isOwner: role === UserRoles.OWNER,
    isReferee: role === UserRoles.REFEREE,
    isViewer: role === UserRoles.VIEWER,
    isAuthenticated: !!role,
    login,
    logout,
    setOwner,
    setTablePin,
    setTournamentToken,
  }), [role, tableId, ownerPin, tablePin, tournamentToken, isRestoring, login, logout, setOwner, setTablePin, setTournamentToken])

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