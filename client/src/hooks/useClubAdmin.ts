/**
 * useClubAdmin - Club admin operations hook
 *
 * Handles club config check, admin PIN verification, and club setup.
 * Delegates socket I/O — no business logic.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'

export interface ClubConfigData {
  configured: boolean
  clubName?: string
  sport?: string
}

export interface ClubSetupData {
  clubName: string
  sport: string
  adminPin: string
  courtCount?: number
  costPerMinute?: number
  currency?: string
}

export interface UseClubAdminOptions {
  /**
   * Called with the signed JWT returned by CLUB_ADMIN_VERIFIED so AuthContext
   * can persist it for socket reconnect (REQ-10/12). Optional so the hook
   * stays usable in pages that don't need session persistence.
   */
  setSessionToken?: (token: string) => void
}

export function useClubAdmin(
  socket: Socket | null,
  connected: boolean,
  options: UseClubAdminOptions = {},
) {
  const [clubConfig, setClubConfig] = useState<ClubConfigData | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupComplete, setSetupComplete] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  /** Check club config via REST endpoint */
  const checkClubConfig = useCallback(async (): Promise<ClubConfigData> => {
    setConfigLoading(true)
    setConfigError(null)
    try {
      const res = await fetch('/api/club/config')
      if (!res.ok) throw new Error('Failed to fetch club config')
      const data: ClubConfigData = await res.json()
      setClubConfig(data)
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR'
      setConfigError(msg)
      throw err
    } finally {
      setConfigLoading(false)
    }
  }, [])

  /** Verify admin PIN via WebSocket — emits CLUB_VERIFY_ADMIN, waits for CLUB_ADMIN_VERIFIED */
  const verifyAdminPin = useCallback((pin: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socket || !connected) {
        setVerifyError('NO_CONNECTION')
        resolve(false)
        return
      }

      setVerifyLoading(true)
      setVerifyError(null)

      const timeoutId = setTimeout(() => {
        cleanup()
        setVerifyError('TIMEOUT')
        resolve(false)
      }, 5000)

      const handleVerified = (data: { success?: boolean; token?: string }) => {
        cleanup()
        setIsAdmin(true)
        // Store the JWT for socket reconnect (REQ-10/12). The presence of a
        // token is optional for older flows — only persist when present.
        if (data?.token && options.setSessionToken) {
          options.setSessionToken(data.token)
        }
        resolve(true)
      }

      const handleError = (err: { code: string; message: string }) => {
        cleanup()
        setVerifyError(err.code || 'VERIFY_FAILED')
        resolve(false)
      }

      const handleDisconnect = () => {
        cleanup()
        setVerifyError('DISCONNECTED')
        resolve(false)
      }

      let cleanupCalled = false
      const cleanup = () => {
        if (cleanupCalled) return
        cleanupCalled = true
        clearTimeout(timeoutId)
        socket.off(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, handleVerified)
        socket.off(SocketEvents.SERVER.ERROR, handleError)
        socket.off('disconnect', handleDisconnect)
        setVerifyLoading(false)
      }

      socket.once(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, handleVerified)
      socket.once(SocketEvents.SERVER.ERROR, handleError)
      socket.on('disconnect', handleDisconnect)
      socket.emit(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin })
    })
  }, [socket, connected])

  /** Submit club setup via WebSocket */
  const submitSetup = useCallback((data: ClubSetupData) => {
    if (!socket || !connected) {
      setSetupError('NO_CONNECTION')
      return
    }
    setSetupLoading(true)
    setSetupError(null)
    // Map adminPin → pin (server expects "pin")
    const { adminPin, ...rest } = data
    socket.emit(SocketEvents.CLIENT.CLUB_SETUP, { ...rest, pin: adminPin })
  }, [socket, connected])

  /** Reset the club setup — verified admin only. Wipes club config so the
   *  first-run wizard can run again. Never touches inventory or history. */
  const resetSetup = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socket || !connected) {
        setResetError('NO_CONNECTION')
        resolve(false)
        return
      }
      setResetLoading(true)
      setResetError(null)

      const timeoutId = setTimeout(() => {
        cleanup()
        setResetError('TIMEOUT')
        resolve(false)
      }, 5000)

      const handleReset = () => {
        cleanup()
        setSetupComplete(false)
        setClubConfig({ configured: false })
        resolve(true)
      }

      const handleError = (err: { code: string; message: string }) => {
        cleanup()
        setResetError(err.code || 'RESET_FAILED')
        resolve(false)
      }

      let cleanupCalled = false
      const cleanup = () => {
        if (cleanupCalled) return
        cleanupCalled = true
        clearTimeout(timeoutId)
        socket.off(SocketEvents.SERVER.CLUB_SETUP_RESET, handleReset)
        socket.off(SocketEvents.SERVER.ERROR, handleError)
        setResetLoading(false)
      }

      socket.once(SocketEvents.SERVER.CLUB_SETUP_RESET, handleReset)
      socket.once(SocketEvents.SERVER.ERROR, handleError)
      socket.emit(SocketEvents.CLIENT.CLUB_RESET_SETUP)
    })
  }, [socket, connected])

  // Listen for setup completion and socket lifecycle events
  useEffect(() => {
    if (!socket) return

    const handleSetupComplete = () => {
      setSetupLoading(false)
      setSetupComplete(true)
    }

    const handleError = (err: { code: string; message: string }) => {
      setSetupLoading(false)
      setSetupError(err.code || 'SETUP_FAILED')
    }

    const handleDisconnect = () => {
      setIsAdmin(false)
      setVerifyError('DISCONNECTED')
    }

    /** Session restored from JWT on page reload (REQ-11). The server
     *  verified the JWT in the io.use() middleware and set socket.data.
     *  isClubAdmin — this lets us restore the admin UI without asking
     *  for the PIN again. */
    const handleSessionRestored = () => {
      setIsAdmin(true)
    }

    socket.on(SocketEvents.SERVER.CLUB_SETUP_COMPLETE, handleSetupComplete)
    socket.on(SocketEvents.SERVER.ERROR, handleError)
    socket.on('disconnect', handleDisconnect)
    socket.on(SocketEvents.SERVER.CLUB_SESSION_RESTORED, handleSessionRestored)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_SETUP_COMPLETE, handleSetupComplete)
      socket.off(SocketEvents.SERVER.ERROR, handleError)
      socket.off('disconnect', handleDisconnect)
      socket.off(SocketEvents.SERVER.CLUB_SESSION_RESTORED, handleSessionRestored)
    }
  }, [socket])

  // Ask for club config once connected. The server re-emits
  // CLUB_SESSION_RESTORED when this socket is an admin (see ClubAdminHandler
  // CLUB_GET_CONFIG), closing the race where the connection-time emit arrives
  // before this hook's listener above is registered — a reload with a valid
  // JWT would otherwise land back on the PIN screen.
  useEffect(() => {
    if (!socket || !connected) return
    socket.emit(SocketEvents.CLIENT.CLUB_GET_CONFIG)
  }, [socket, connected])

  const clearVerifyError = useCallback(() => setVerifyError(null), [])
  const clearSetupError = useCallback(() => setSetupError(null), [])
  const clearResetError = useCallback(() => setResetError(null), [])

  return {
    clubConfig,
    configLoading,
    configError,
    isAdmin,
    verifyLoading,
    verifyError,
    setupLoading,
    setupError,
    setupComplete,
    resetLoading,
    resetError,
    checkClubConfig,
    verifyAdminPin,
    submitSetup,
    resetSetup,
    clearVerifyError,
    clearSetupError,
    clearResetError,
  }
}
