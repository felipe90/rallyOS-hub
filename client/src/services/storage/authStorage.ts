/**
 * Auth storage service
 *
 * Abstracts localStorage/sessionStorage access for auth state.
 * No React dependencies - testable in isolation.
 */

import type { UserRole } from '@/contexts/AuthContext/AuthContext.types'

const ROLE_KEY = 'role'
const COURT_ID_KEY = 'tableId'
const OWNER_PIN_KEY = 'ownerPin'
const COURT_PIN_KEY = 'tablePin'
const TOURNAMENT_TOKEN_KEY = 'tournamentToken'

export const authStorage = {
  getRole: (): UserRole => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ROLE_KEY) as UserRole
  },

  setRole: (role: UserRole): void => {
    if (typeof window === 'undefined') return
    if (role) {
      localStorage.setItem(ROLE_KEY, role)
    } else {
      localStorage.removeItem(ROLE_KEY)
    }
  },

  getCourtId: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(COURT_ID_KEY)
  },

  setCourtId: (courtId: string | null): void => {
    if (typeof window === 'undefined') return
    if (courtId) {
      localStorage.setItem(COURT_ID_KEY, courtId)
    } else {
      localStorage.removeItem(COURT_ID_KEY)
    }
  },

  getOwnerPin: (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(OWNER_PIN_KEY)
  },

  setOwnerPin: (pin: string | null): void => {
    if (typeof window === 'undefined') return
    if (pin) {
      sessionStorage.setItem(OWNER_PIN_KEY, pin)
    } else {
      sessionStorage.removeItem(OWNER_PIN_KEY)
    }
  },

  getCourtPin: (): string | null => {
    // PINs are no longer persisted — always return null
    // PINs are stored in memory only (React state)
    return null
  },

  setCourtPin: (_pin: string | null): void => {
    // PINs are no longer persisted to browser storage
    // This is a no-op — PINs are stored in memory only (React state)
  },

  getTournamentToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOURNAMENT_TOKEN_KEY)
  },

  setTournamentToken: (token: string | null): void => {
    if (typeof window === 'undefined') return
    if (token) {
      localStorage.setItem(TOURNAMENT_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOURNAMENT_TOKEN_KEY)
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(COURT_ID_KEY)
    // courtPin is no longer persisted — no need to remove from localStorage
    sessionStorage.removeItem(OWNER_PIN_KEY)
    localStorage.removeItem(TOURNAMENT_TOKEN_KEY)
  },
}
