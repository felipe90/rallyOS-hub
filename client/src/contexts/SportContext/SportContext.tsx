import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react'
import { SocketEvents } from '@shared/events'
import { SPORT } from '@shared/types'
import type { Sport } from '@shared/types'
import { useSocketContext } from '../SocketContext'

/**
 * SportContext - resolves the club's sport once per session and exposes it
 * to every consumer via useSport().
 *
 * Club config (`ClubConfigStore.sport`) is the single source of truth for
 * sport TERMINOLOGY across admin, tournament, scoreboard and kiosk views
 * (spec ST-1). Scoring adapters keep resolving from `match.sport` (FSA-1);
 * this context only drives terminology.
 *
 * Resolution protocol (mirrors useClubAdmin.ts:187-190):
 *   1. Register a CLUB_CONFIG listener once the socket exists. socket.io
 *      listeners survive reconnects, so no re-registration is needed.
 *   2. On every connect transition, emit CLUB_GET_CONFIG (Client→Server).
 *      Because the listener is registered first, the response is never missed.
 *   3. sport = clubConfig.sport ?? 'tableTennis' (normalized like
 *      ClubPlayerHandler.ts:207 — an unknown value falls back to TT).
 *      sportLoaded = clubConfig.sport !== null.
 *   4. The resolved sport is cached for the session — the provider mounts
 *      once in App.tsx and never re-fetches per route.
 *
 * The context value is memoized (C1 pattern, SocketContext.tsx:50) so
 * consumers do not re-render on unrelated provider re-renders.
 */
export interface SportContextValue {
  sport: Sport
  /** true once CLUB_CONFIG delivered a configured sport (non-null). */
  sportLoaded: boolean
}

export const SportContext = createContext<SportContextValue | undefined>(undefined)

interface SportProviderProps {
  children: ReactNode
}

export function SportProvider({ children }: SportProviderProps) {
  const { socket, connected } = useSocketContext()
  const [clubSport, setClubSport] = useState<Sport | null>(null)

  // Listen for CLUB_CONFIG (Server→Client). Registered on socket existence so
  // it survives reconnects; the emit below re-fires per connect transition.
  useEffect(() => {
    if (!socket) return

    const handleClubConfig = (data: { sport?: string | null }) => {
      // Normalize exactly like the server (ClubPlayerHandler.ts:207): only
      // padel is distinct; everything else (including null/unknown) is TT.
      if (data?.sport) {
        setClubSport(data.sport === SPORT.PADEL ? SPORT.PADEL : SPORT.TABLE_TENNIS)
      }
    }

    socket.on(SocketEvents.SERVER.CLUB_CONFIG, handleClubConfig)
    return () => {
      socket.off(SocketEvents.SERVER.CLUB_CONFIG, handleClubConfig)
    }
  }, [socket])

  // Ask for club config once connected (mirror useClubAdmin.ts:187-190).
  useEffect(() => {
    if (!socket || !connected) return
    socket.emit(SocketEvents.CLIENT.CLUB_GET_CONFIG)
  }, [socket, connected])

  const sport = clubSport ?? SPORT.TABLE_TENNIS
  const sportLoaded = clubSport !== null

  // C1 referential stability — value only rebuilds when sport/sportLoaded
  // actually change, avoiding a re-render of every consumer on each socket
  // broadcast (same pattern as SocketContext.tsx:50).
  const value = useMemo(() => ({ sport, sportLoaded }), [sport, sportLoaded])

  return <SportContext.Provider value={value}>{children}</SportContext.Provider>
}

export function useSport(): SportContextValue {
  const context = React.useContext(SportContext)
  if (!context) {
    throw new Error('useSport must be used within SportProvider')
  }
  return context
}
