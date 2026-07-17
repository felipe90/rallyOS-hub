/**
 * useRefereeSession - localStorage-based PIN session persistence for referees
 *
 * Saves referee PIN sessions to localStorage so that page refresh
 * does not require re-entering the PIN. Sessions are self-invalidating
 * when the table transitions to FINISHED or the referee leaves.
 *
 * All localStorage access is wrapped in try/catch for graceful degradation
 * when localStorage is unavailable (e.g. private browsing).
 */

import { useCallback } from 'react'
import type { CourtInfo } from '@shared/types'

const LS_PREFIX = 'rallyos_ref_session_'

export interface RefereeSession {
  pin: string
  joinedAt: number
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage unavailable — silently degrade
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // localStorage unavailable — silently degrade
  }
}

function getSessionKey(tableId: string): string {
  return `${LS_PREFIX}${tableId}`
}

/**
 * Valid table statuses for which a stored session is considered still valid.
 * If a table is FINISHED, the stored session must be discarded.
 */
const VALID_TABLE_STATUSES = new Set<string>(['WAITING', 'CONFIGURING', 'LIVE'])

export function useRefereeSession() {
  /** Save a referee session for a given table */
  const saveSession = useCallback((tableId: string, pin: string): void => {
    const session: RefereeSession = { pin, joinedAt: Date.now() }
    safeSetItem(getSessionKey(tableId), JSON.stringify(session))
  }, [])

  /** Retrieve a saved session for a given table (or null if missing/corrupt) */
  const getSession = useCallback((tableId: string): RefereeSession | null => {
    const raw = safeGetItem(getSessionKey(tableId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as RefereeSession
    } catch {
      safeRemoveItem(getSessionKey(tableId)) // clear corrupt data
      return null
    }
  }, [])

  /** Clear a saved session for a given table */
  const clearSession = useCallback((tableId: string): void => {
    safeRemoveItem(getSessionKey(tableId))
  }, [])

  /**
   * Find any valid stored session across all tables.
   *
   * Iterates localStorage keys, matches them against the provided
   * table list, and returns the first session whose table status is
   * WAITING, CONFIGURING, or LIVE.
   *
   * Stale sessions (table FINISHED or table not found) are automatically
   * cleared from localStorage.
   */
  const findAnyValidSession = useCallback(
    (tables: CourtInfo[]): { tableId: string; pin: string } | null => {
      try {
        // Build a map of tableId → status for quick lookup
        const tableMap = new Map(tables.map((t) => [t.id, t.status]))

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key || !key.startsWith(LS_PREFIX)) continue

          const tableId = key.slice(LS_PREFIX.length)
          const tableStatus = tableMap.get(tableId)

          if (tableStatus && VALID_TABLE_STATUSES.has(tableStatus)) {
            const session = getSession(tableId)
            if (session) {
              return { tableId, pin: session.pin }
            }
          }

          // Table not found or FINISHED — clear stale session
          if (!tableStatus || tableStatus === 'FINISHED') {
            clearSession(tableId)
          }
        }
      } catch {
        // localStorage iteration failed — silently degrade
      }
      return null
    },
    [getSession, clearSession],
  )

  return { saveSession, getSession, clearSession, findAnyValidSession }
}
