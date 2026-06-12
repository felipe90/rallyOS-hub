import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { AuthContextValue, UserRole } from './AuthContext.types'
import { UserRoles } from './AuthContext.types'
import { authStorage } from '@/services/storage/authStorage'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null)
  const [courtId, setCourtId] = useState<string | null>(null)
  const [ownerPin, setOwnerPin] = useState<string | null>(null)
  const [courtPin, setCourtPinState] = useState<string | null>(null)
  const [tournamentToken, setTournamentTokenState] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)

  // Restore auth state from storage on mount
  useEffect(() => {
    const savedRole = authStorage.getRole()
    if (savedRole) {
      setRole(savedRole)
      setCourtId(authStorage.getCourtId())
      setTournamentTokenState(authStorage.getTournamentToken())
      // ownerPin and courtPin are NOT restored from storage (security)
    }
    setIsRestoring(false)
  }, [])

  const login = useCallback((newRole: UserRole, tId?: string, pin?: string) => {
    if (newRole) {
      setRole(newRole)
      authStorage.setRole(newRole)
    }
    if (tId) {
      setCourtId(tId)
      authStorage.setCourtId(tId)
    }
    if (pin) {
      setOwnerPin(pin)
      // PIN is NOT persisted to storage (security)
    }
  }, [])

  const logout = useCallback(() => {
    setRole(null)
    setCourtId(null)
    setOwnerPin(null)
    setCourtPinState(null)
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

  const setCourtPin = useCallback((pin: string) => {
    // PIN stored in memory only — never persisted to browser storage
    setCourtPinState(pin)
  }, [])

  const setTournamentToken = useCallback((token: string) => {
    setTournamentTokenState(token)
    authStorage.setTournamentToken(token)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    role,
    courtId,
    ownerPin,
    courtPin,
    tournamentToken,
    isRestoring,
    isOwner: role === UserRoles.OWNER,
    isReferee: role === UserRoles.REFEREE,
    isViewer: role === UserRoles.VIEWER,
    isAuthenticated: !!role,
    login,
    logout,
    setOwner,
    setCourtPin,
    setTournamentToken,
  }), [role, courtId, ownerPin, courtPin, tournamentToken, isRestoring, login, logout, setOwner, setCourtPin, setTournamentToken])

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