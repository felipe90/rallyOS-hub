/**
 * useAuthFlow - Owner authentication flow hook
 *
 * Handles socket events and PIN submission for the owner login process.
 * Extracted from AuthPage to keep the page purely presentational.
 *
 * Returns error codes (strings) — callers translate via i18nText().
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { Routes } from '@/routes'

export interface AuthFlowConfig {
  socket: Socket | null
  connected: boolean
  setOwner: (isOwner: boolean, pin?: string) => void
  login: (role: 'owner', tableId?: string, pin?: string) => void
}

export function useAuthFlow({ socket, connected, setOwner, login }: AuthFlowConfig) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  // Store the submitted PIN so OWNER_VERIFIED handler can use it.
  // The server sends { token: 'owner-session' } which is NOT the PIN.
  const pinRef = useRef('')

  // Listen for OWNER_VERIFIED and ERROR events from the server
  useEffect(() => {
    if (!socket) return

    const handleOwnerVerified = (_data: { token: string }) => {
      setLoading(false)
      setOwner(true, pinRef.current)
      login('owner', undefined, pinRef.current)
      navigate(Routes.DASHBOARD_OWNER)
    }

    const handleError = (err: { code: string; message: string }) => {
      setError(err.code)
      setLoading(false)
    }

    socket.on(SocketEvents.SERVER.OWNER_VERIFIED, handleOwnerVerified)
    socket.on('ERROR', handleError)

    return () => {
      socket.off(SocketEvents.SERVER.OWNER_VERIFIED, handleOwnerVerified)
      socket.off('ERROR', handleError)
    }
  }, [socket, login, navigate, setOwner])

  // Submit owner PIN for verification
  const submitPin = useCallback(
    (pin: string) => {
      if (!validateOwnerPin(pin)) {
        setError('INVALID_OWNER_PIN_FORMAT')
        return
      }

      setError('')
      setLoading(true)
      pinRef.current = pin

      if (socket && connected) {
        socket.emit(SocketEvents.CLIENT.VERIFY_OWNER, { pin })
      } else {
        setError('CONNECTION_ERROR')
        setLoading(false)
      }
    },
    [socket, connected],
  )

  const clearError = useCallback(() => setError(''), [])

  return { submitPin, error, loading, clearError }
}

/**
 * Validate owner PIN has exactly 8 numeric digits.
 */
function validateOwnerPin(pin: string): boolean {
  return /^\d{8}$/.test(pin)
}
