/**
 * useClubAdmin - Club admin operations hook
 *
 * Handles club config check, admin PIN verification, and club setup.
 * Delegates socket I/O — no business logic.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
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
}

export function useClubAdmin(socket: Socket | null, connected: boolean) {
  const [clubConfig, setClubConfig] = useState<ClubConfigData | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupComplete, setSetupComplete] = useState(false)

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

      const handleVerified = () => {
        cleanup()
        setIsAdmin(true)
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
    socket.emit(SocketEvents.CLIENT.CLUB_SETUP, data)
  }, [socket, connected])

  // Listen for setup completion
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

    socket.on(SocketEvents.SERVER.CLUB_SETUP_COMPLETE, handleSetupComplete)
    socket.on(SocketEvents.SERVER.ERROR, handleError)

    return () => {
      socket.off(SocketEvents.SERVER.CLUB_SETUP_COMPLETE, handleSetupComplete)
      socket.off(SocketEvents.SERVER.ERROR, handleError)
    }
  }, [socket])

  const clearVerifyError = useCallback(() => setVerifyError(null), [])
  const clearSetupError = useCallback(() => setSetupError(null), [])

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
    checkClubConfig,
    verifyAdminPin,
    submitSetup,
    clearVerifyError,
    clearSetupError,
  }
}
