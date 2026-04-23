/**
 * Auth storage service
 *
 * Abstracts localStorage/sessionStorage access for auth state.
 * No React dependencies - testable in isolation.
 */

import type { UserRole } from '@/contexts/AuthContext/AuthContext.types'

const ROLE_KEY = 'role'
const TABLE_ID_KEY = 'tableId'
const OWNER_PIN_KEY = 'ownerPin'
const TABLE_PIN_KEY = 'tablePin'

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

  getTableId: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TABLE_ID_KEY)
  },

  setTableId: (tableId: string | null): void => {
    if (typeof window === 'undefined') return
    if (tableId) {
      localStorage.setItem(TABLE_ID_KEY, tableId)
    } else {
      localStorage.removeItem(TABLE_ID_KEY)
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

  getTablePin: (): string | null => {
    // PINs are no longer persisted — always return null
    // PINs are stored in memory only (React state)
    return null
  },

  setTablePin: (_pin: string | null): void => {
    // PINs are no longer persisted to browser storage
    // This is a no-op — PINs are stored in memory only (React state)
  },

  clear: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(TABLE_ID_KEY)
    // tablePin is no longer persisted — no need to remove from localStorage
    sessionStorage.removeItem(OWNER_PIN_KEY)
  },
}
