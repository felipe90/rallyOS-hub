import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { AuthContextValue, UserRole } from './AuthContext.types'
import { UserRoles } from './AuthContext.types'
import { authStorage } from '@/services/storage/authStorage'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ── Session JWT helpers (REQ-14/15) ─────────────────────────────────
// Local decode of the JWT role/exp so AuthContext can restore auth state
// optimistically on reload, pending server-handshake confirmation.
// 30s leeway mirrors the server SessionTokenService.Clock skew leeway.
const SESSION_LEEWAY_SECONDS = 30

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.')
  if (segments.length !== 3) return null
  try {
    const json = atob(segments[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isSessionJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload) return true
  const exp = payload.exp
  if (typeof exp !== 'number') return true
  const now = Math.floor(Date.now() / 1000)
  return exp + SESSION_LEEWAY_SECONDS < now
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null)
  const [courtId, setCourtId] = useState<string | null>(null)
  const [ownerPin, setOwnerPin] = useState<string | null>(null)
  const [courtPin, setCourtPinState] = useState<string | null>(null)
  const [tournamentToken, setTournamentTokenState] = useState<string | null>(null)
  const [sessionToken, setSessionTokenState] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)

  // Restore auth state from storage on mount.
  // REQ-14: restore role + sessionToken from the JWT (role derived locally).
  // REQ-15: if the stored JWT is expired/invalid, clear it and force login
  // (do NOT restore an authenticated role — the user must re-enter PIN).
  useEffect(() => {
    const savedRole = authStorage.getRole()
    const storedSessionToken = authStorage.getSessionToken()

    if (storedSessionToken) {
      if (isSessionJwtExpired(storedSessionToken)) {
        // Expired/invalid → clear and force login.
        authStorage.setSessionToken(null)
        setIsRestoring(false)
        return
      }
      // Valid within leeway → restore optimistically from the JWT/local role.
      setSessionTokenState(storedSessionToken)
      if (savedRole) {
        setRole(savedRole)
        setCourtId(authStorage.getCourtId())
        setTournamentTokenState(authStorage.getTournamentToken())
      } else {
        // Derive role locally from JWT claim (owner only — club admin auth
        // state is managed by useClubAdmin, not AuthContext).
        const payload = decodeJwtPayload(storedSessionToken)
        if (payload?.role === 'tournament_owner') {
          setRole(UserRoles.OWNER)
        }
      }
    } else if (savedRole) {
      setRole(savedRole)
      setCourtId(authStorage.getCourtId())
      setTournamentTokenState(authStorage.getTournamentToken())
    }
    // ownerPin and courtPin are NOT restored from storage (security)
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
    setSessionTokenState(null)
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

  const setSessionToken = useCallback((token: string) => {
    setSessionTokenState(token)
    authStorage.setSessionToken(token)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    role,
    courtId,
    ownerPin,
    courtPin,
    tournamentToken,
    sessionToken,
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
    setSessionToken,
  }), [role, courtId, ownerPin, courtPin, tournamentToken, sessionToken, isRestoring, login, logout, setOwner, setCourtPin, setTournamentToken, setSessionToken])

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