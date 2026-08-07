/**
 * useSocketState - Manages table/match state from socket events
 *
 * Single responsibility: listen to socket events and update state.
 */

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { COURT_MODE } from '@shared/types'
import type { CourtInfo, CourtInfoWithPin, MatchStateExtended, ScoreChange, AllHistoryEntry, KioskNotificationData, TournamentBracket } from '@shared/types'

export interface HubConfigData {
  ssid: string
  ip: string
  port: number
  wifiPassword: string
  domain: string
}

// Lightweight structural signature used to detect no-op `COURT_UPDATE` events.
// The courts DTO is small and fully serializable, so JSON is a cheap,
// future-proof comparison key (falls back to updating whenever an unknown field
// appears in the payload, since a new key yields a different signature).
const courtSignature = (court: CourtInfo): string => JSON.stringify(court)

export function useSocketState(socket: Socket | null) {
  const [courts, setCourts] = useState<CourtInfo[]>([])
  const [currentMatch, setCurrentMatch] = useState<MatchStateExtended | null>(null)
  const [currentCourt, setCurrentCourt] = useState<CourtInfo | null>(null)
  const [appError, setAppError] = useState<string | null>(null)
  const [allHistories, setAllHistories] = useState<AllHistoryEntry[] | null>(null)
  const [hubConfig, setHubConfig] = useState<HubConfigData | null>(null)
  const [kioskNotification, setKioskNotification] = useState<KioskNotificationData | null>(null)
  // Bracket state is lifted into context (like `courts`) so the kiosk bracket
  // page can read the current snapshot the moment it mounts — regardless of
  // when the owner switched the kiosk to bracket mode. The server pushes
  // BRACKET_STATE on connect and broadcasts on every mutation; this listener
  // is registered at socket creation and persists across kiosk mode switches.
  const [bracket, setBracket] = useState<TournamentBracket | null>(null)

  useEffect(() => {
    if (!socket) return

    // Request the public court list on (re)mount: the server pushes
    // COURT_LIST once at connection time, but a page reload can attach these
    // listeners AFTER that one-shot emit (the socket is created by
    // useSocketConnection while this effect still holds the previous/null
    // ref). LIST_COURTS returns the same COURT_LIST payload on demand
    // (CourtEventHandler) — closes the reload race for the owner grid.
    socket.emit(SocketEvents.CLIENT.LIST_COURTS)

    const handleCourtUpdate = (court: CourtInfo) => {
      // Reject club courts — OwnerDashboard only shows tournament courts.
      if (court.mode === COURT_MODE.CLUB) return
      // Only update the courts array when the affected court actually changed;
      // returning the previous reference lets React bail out of the re-render
      // for irrelevant / no-op `COURT_UPDATE` broadcasts (e.g. a point scored
      // on a court whose snapshot this client already holds).
      setCourts(prev => {
        const idx = prev.findIndex(t => t.id === court.id)
        if (idx === -1) return [...prev, court]
        const merged = { ...prev[idx], ...court }
        if (courtSignature(prev[idx]) === courtSignature(merged)) return prev
        const next = [...prev]
        next[idx] = merged
        return next
      })
      // Only promote the update to the currently-selected court (or the first
      // court to update after mount), and bail out when the merged data is
      // identical — so a point on a different court never re-renders the
      // current-court view.
      setCurrentCourt(prev => {
        if (prev && prev.id !== court.id) return prev
        const merged = prev ? { ...prev, ...court } : court
        if (prev && courtSignature(prev) === courtSignature(merged)) return prev
        return merged
      })
    }

    const handleCourtList = (list: CourtInfo[]) => setCourts(list)

    // COURT_LIST_WITH_PINS carries ONLY runtime courts that have a PIN — it
    // is NOT the full inventory (inventory-ACTIVE courts without a runtime
    // flow/PIN are absent). Replacing the whole list with this payload would
    // wipe the catalog courts the owner grid needs. Merge: keep every court
    // already known, and layer PINs onto the runtime subset.
    const handleCourtListWithPins = (data: { courts?: CourtInfoWithPin[]; tables?: CourtInfoWithPin[] }) => {
      const withPins = (data.courts || data.tables || []) as CourtInfoWithPin[]
      setCourts(prev => {
        const byId = new Map(prev.map(c => [c.id, c]))
        for (const court of withPins) {
          byId.set(court.id, { ...byId.get(court.id), ...court })
        }
        return [...byId.values()]
      })
    }

    const handleCourtDeleted = (data: { courtId?: string; tableId?: string }) => {
      setCourts(prev => prev.filter(t => t.id !== (data.courtId || data.tableId)))
    }

    const handleCourtCreated = (court: CourtInfo) => {
      // Reject club courts — OwnerDashboard only shows tournament courts.
      if (court.mode === COURT_MODE.CLUB) return
      setCourts(prev => {
        if (prev.find(t => t.id === court.id)) {
          return prev.map(t => (t.id === court.id ? { ...t, ...court } : t))
        }
        return [...prev, court]
      })
    }

    const handleMatchUpdate = (match: MatchStateExtended) => {
      setCurrentMatch(match)
    }

    const handleAllHistory = (data: AllHistoryEntry[]) => {
      setAllHistories(data)
    }

    const handleError = (data: { code: string; message: string }) => {
      setAppError(data.message)
    }

    const handleHubConfig = (data: HubConfigData) => {
      setHubConfig(data)
    }

    const handleKioskNotification = (data: KioskNotificationData | null) => {
      setKioskNotification(data)
    }

    const handleBracketState = (data: TournamentBracket | null) => {
      setBracket(data)
    }

    socket.on(SocketEvents.SERVER.ERROR, handleError)
    socket.on(SocketEvents.SERVER.COURT_UPDATE, handleCourtUpdate)
    socket.on(SocketEvents.SERVER.COURT_LIST, handleCourtList)
    socket.on(SocketEvents.SERVER.COURT_LIST_WITH_PINS, handleCourtListWithPins)
    socket.on(SocketEvents.SERVER.COURT_DELETED, handleCourtDeleted)
    socket.on(SocketEvents.SERVER.COURT_CREATED, handleCourtCreated)
    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    socket.on(SocketEvents.SERVER.ALL_HISTORY, handleAllHistory)
    socket.on(SocketEvents.SERVER.HUB_CONFIG, handleHubConfig)
    socket.on(SocketEvents.SERVER.KIOSK_NOTIFICATION, handleKioskNotification)
    socket.on(SocketEvents.SERVER.BRACKET_STATE, handleBracketState)

    return () => {
      socket.off(SocketEvents.SERVER.ERROR, handleError)
      socket.off(SocketEvents.SERVER.COURT_UPDATE, handleCourtUpdate)
      socket.off(SocketEvents.SERVER.COURT_LIST, handleCourtList)
      socket.off(SocketEvents.SERVER.COURT_LIST_WITH_PINS, handleCourtListWithPins)
      socket.off(SocketEvents.SERVER.COURT_DELETED, handleCourtDeleted)
      socket.off(SocketEvents.SERVER.COURT_CREATED, handleCourtCreated)
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
      socket.off(SocketEvents.SERVER.ALL_HISTORY, handleAllHistory)
      socket.off(SocketEvents.SERVER.HUB_CONFIG, handleHubConfig)
      socket.off(SocketEvents.SERVER.KIOSK_NOTIFICATION, handleKioskNotification)
      socket.off(SocketEvents.SERVER.BRACKET_STATE, handleBracketState)
    }
  }, [socket])

  return { courts, currentMatch, currentCourt, appError, allHistories, hubConfig, kioskNotification, bracket }
}
