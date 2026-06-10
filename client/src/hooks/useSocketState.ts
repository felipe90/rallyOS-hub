/**
 * useSocketState - Manages table/match state from socket events
 *
 * Single responsibility: listen to socket events and update state.
 */

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { TableInfo, TableInfoWithPin, MatchStateExtended, ScoreChange, AllHistoryEntry, KioskNotificationData } from '@shared/types'

export interface HubConfigData {
  ssid: string
  ip: string
  port: number
  wifiPassword: string
  domain: string
}

export function useSocketState(socket: Socket | null) {
  const [courts, setCourts] = useState<TableInfo[]>([])
  const [currentMatch, setCurrentMatch] = useState<MatchStateExtended | null>(null)
  const [currentCourt, setCurrentCourt] = useState<TableInfo | null>(null)
  const [appError, setAppError] = useState<string | null>(null)
  const [allHistories, setAllHistories] = useState<AllHistoryEntry[] | null>(null)
  const [hubConfig, setHubConfig] = useState<HubConfigData | null>(null)
  const [kioskNotification, setKioskNotification] = useState<KioskNotificationData | null>(null)

  useEffect(() => {
    if (!socket) return

    const handleCourtUpdate = (court: TableInfo) => {
      setCourts(prev =>
        prev.find(t => t.id === court.id)
          ? prev.map(t => (t.id === court.id ? { ...t, ...court } : t))
          : [...prev, court],
      )
      setCurrentCourt(court)
    }

    const handleCourtList = (list: TableInfo[]) => setCourts(list)

    const handleCourtListWithPins = (data: { tables: TableInfoWithPin[] }) => {
      setCourts(data.tables as TableInfo[])
    }

    const handleCourtDeleted = ({ tableId: courtId }: { tableId: string }) => {
      setCourts(prev => prev.filter(t => t.id !== courtId))
    }

    const handleCourtCreated = (court: TableInfo) => {
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

    socket.on(SocketEvents.SERVER.ERROR, handleError)
    socket.on(SocketEvents.SERVER.TABLE_UPDATE, handleCourtUpdate)
    socket.on(SocketEvents.SERVER.TABLE_LIST, handleCourtList)
    socket.on(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, handleCourtListWithPins)
    socket.on(SocketEvents.SERVER.TABLE_DELETED, handleCourtDeleted)
    socket.on(SocketEvents.SERVER.TABLE_CREATED, handleCourtCreated)
    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    socket.on(SocketEvents.SERVER.ALL_HISTORY, handleAllHistory)
    socket.on(SocketEvents.SERVER.HUB_CONFIG, handleHubConfig)
    socket.on(SocketEvents.SERVER.KIOSK_NOTIFICATION, handleKioskNotification)

    return () => {
      socket.off(SocketEvents.SERVER.ERROR, handleError)
      socket.off(SocketEvents.SERVER.TABLE_UPDATE, handleCourtUpdate)
      socket.off(SocketEvents.SERVER.TABLE_LIST, handleCourtList)
      socket.off(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, handleCourtListWithPins)
      socket.off(SocketEvents.SERVER.TABLE_DELETED, handleCourtDeleted)
      socket.off(SocketEvents.SERVER.TABLE_CREATED, handleCourtCreated)
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
      socket.off(SocketEvents.SERVER.ALL_HISTORY, handleAllHistory)
      socket.off(SocketEvents.SERVER.HUB_CONFIG, handleHubConfig)
      socket.off(SocketEvents.SERVER.KIOSK_NOTIFICATION, handleKioskNotification)
    }
  }, [socket])

  return { courts, currentMatch, currentCourt, appError, allHistories, hubConfig, kioskNotification }
}
