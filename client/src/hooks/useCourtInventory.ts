/**
 * useCourtInventory — single catalog + availability hook (INV-6, D12).
 *
 * Replaces useCourtManagement + useClubCourtManagement: ONE catalog + derived
 * availability view for the admin inventory UI and the owner picker. The hook
 * is a thin wiring layer — the reconciliation logic lives in the pure service
 * services/courts/reconcileInventory (tested without React).
 *
 * Wire sources (reconciled on every event):
 *   - INVENTORY_UPDATED → catalog (CourtRecord[])
 *   - CLUB_KIOSK_DATA   → club flows
 *   - COURT_LIST        → tournament runtime courts
 *   - BRACKET_STATE     → bindings → BUSY (INV-4)
 *
 * Actions: add/rename/setMaintenance/archive/forceEnd (INVENTORY_* admin)
 * + activate/deactivate/reset/adminOccupy (bridge club-flow actions on
 * inventory courts — the legacy hooks are deleted in slice 5.4, these stay).
 *
 * NOTE: exceeds the 80-line hook guideline — it is a socket-wiring + action
 * surface hook with many emitted events (precedent: useClubCourtManagement).
 * The computational logic is fully delegated to the pure service.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type {
  ClubKioskCourtInfo,
  CourtInfo,
  CourtRecord,
  SessionMode,
  TournamentBracket,
} from '@shared/types'
import {
  reconcileInventory,
  type InventoryCourtView,
} from '@/services/courts/reconcileInventory'

export function useCourtInventory(socket: Socket | null, connected: boolean) {
  const [catalog, setCatalog] = useState<CourtRecord[]>([])
  const [clubFlows, setClubFlows] = useState<ClubKioskCourtInfo[]>([])
  const [tournamentCourts, setTournamentCourts] = useState<CourtInfo[]>([])
  const [bracket, setBracket] = useState<TournamentBracket | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── wire sources → state ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const onInventory = (data: { courts: CourtRecord[] }) => {
      setCatalog(data?.courts ?? [])
      // Any catalog snapshot arriving means the pending mutation completed —
      // release the loading flag (buttons re-enable).
      setLoading(false)
    }
    const onKiosk = (data: ClubKioskPayloadLike) => {
      setClubFlows(data?.courts ?? [])
      // Club-flow snapshots (activate/occupy/end) also complete a pending
      // action — clear loading so admin buttons re-enable.
      setLoading(false)
    }
    const onCourtList = (data: CourtInfo[]) => {
      setTournamentCourts(data ?? [])
      setLoading(false)
    }
    const onBracket = (data: TournamentBracket | null) => {
      setBracket(data)
      setLoading(false)
    }
    const onError = (err: { code: string; message: string }) => {
      setError(err?.code || 'UNKNOWN_ERROR')
      setLoading(false)
    }

    socket.on(SocketEvents.SERVER.INVENTORY_UPDATED, onInventory)
    socket.on(SocketEvents.SERVER.CLUB_KIOSK_DATA, onKiosk)
    socket.on(SocketEvents.SERVER.COURT_LIST, onCourtList)
    socket.on(SocketEvents.SERVER.BRACKET_STATE, onBracket)
    socket.on(SocketEvents.SERVER.ERROR, onError)

    return () => {
      socket.off(SocketEvents.SERVER.INVENTORY_UPDATED, onInventory)
      socket.off(SocketEvents.SERVER.CLUB_KIOSK_DATA, onKiosk)
      socket.off(SocketEvents.SERVER.COURT_LIST, onCourtList)
      socket.off(SocketEvents.SERVER.BRACKET_STATE, onBracket)
      socket.off(SocketEvents.SERVER.ERROR, onError)
    }
  }, [socket])

  // ── derived view (pure service) ───────────────────────────────────────
  const courts: InventoryCourtView[] = useMemo(
    () => reconcileInventory({ catalog, clubFlows, tournamentCourts, bracket }),
    [catalog, clubFlows, tournamentCourts, bracket],
  )

  const emitAction = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (!socket || !connected) {
        setError('NO_CONNECTION')
        return
      }
      setLoading(true)
      setError(null)
      socket.emit(event, payload)
    },
    [socket, connected],
  )

  // ── INVENTORY_* admin actions ─────────────────────────────────────────
  const add = useCallback((name?: string) => {
    emitAction(SocketEvents.CLIENT.INVENTORY_ADD, { name: name ?? undefined })
  }, [emitAction])

  const rename = useCallback((courtId: string, name: string) => {
    emitAction(SocketEvents.CLIENT.INVENTORY_RENAME, { courtId, name })
  }, [emitAction])

  const setMaintenance = useCallback((courtId: string, maintenance: boolean) => {
    emitAction(SocketEvents.CLIENT.INVENTORY_MAINTENANCE, { courtId, maintenance })
  }, [emitAction])

  const archive = useCallback((courtId: string) => {
    emitAction(SocketEvents.CLIENT.INVENTORY_ARCHIVE, { courtId })
  }, [emitAction])

  const forceEnd = useCallback((courtId: string) => {
    emitAction(SocketEvents.CLIENT.INVENTORY_FORCE_END, { courtId })
  }, [emitAction])

  // ── Bridge club-flow actions on inventory courts (removed in 5.4) ─────
  const activate = useCallback((courtId: string) => {
    emitAction(SocketEvents.CLIENT.CLUB_ACTIVATE_COURT, { courtId })
  }, [emitAction])

  const deactivate = useCallback((courtId: string) => {
    emitAction(SocketEvents.CLIENT.CLUB_DEACTIVATE_COURT, { courtId })
  }, [emitAction])

  const reset = useCallback((courtId: string) => {
    emitAction(SocketEvents.CLIENT.CLUB_RESET_COURT, { courtId })
  }, [emitAction])

  const adminOccupy = useCallback(
    (courtId: string, playerName: string, phone: string, mode: SessionMode) => {
      emitAction(SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY, { courtId, playerName, phone, mode })
    },
    [emitAction],
  )

  // club-featured-courts — toggle featured for a club court. The server is
  // authoritative: local state is reconciled on the next CLUB_KIOSK_DATA
  // broadcast, so we do NOT optimistically flip `featured` here.
  const toggleFeatured = useCallback((courtId: string) => {
    if (!socket || !connected) {
      setError('NO_CONNECTION')
      return
    }
    setLoading(true)
    setError(null)
    const target = courts.find(c => c.courtId === courtId)
    const isFeatured = target?.featured === true
    socket.emit(SocketEvents.CLIENT.SET_FEATURED, {
      targetCourtId: isFeatured ? null : courtId,
    })
  }, [socket, connected, courts])

  const clearError = useCallback(() => setError(null), [])

  return {
    courts,
    loading,
    error,
    clearError,
    add,
    rename,
    setMaintenance,
    archive,
    forceEnd,
    activate,
    deactivate,
    reset,
    adminOccupy,
    toggleFeatured,
  }
}

/** Minimal structural type for the CLUB_KIOSK_DATA payload (wire tolerant). */
type ClubKioskPayloadLike = { courts?: ClubKioskCourtInfo[] }
