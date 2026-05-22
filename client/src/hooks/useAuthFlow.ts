/**
 * useAuthFlow - Owner authentication flow hook
 *
 * Handles socket events and PIN submission for the owner login process.
 * Extracted from AuthPage to keep the page purely presentational.
 *
 * After OWNER_VERIFIED, fetches /api/tournament/status to determine
 * if a prior tournament exists. If yes, blocks navigation until the
 * owner decides to Load or start New via the TournamentResumeModal.
 *
 * Returns error codes (strings) — callers translate via i18nText().
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { Routes } from '@/routes'

export interface TournamentStatus {
  checking: boolean
  exists: boolean
  matchCount: number
  lastSaved: string | null
}

export interface AuthFlowConfig {
  socket: Socket | null
  connected: boolean
  setOwner: (isOwner: boolean, pin?: string) => void
  login: (role: 'owner', tableId?: string, pin?: string) => void
  setTournamentToken: (token: string) => void
}

export function useAuthFlow({ socket, connected, setOwner, login, setTournamentToken }: AuthFlowConfig) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>({
    checking: false,
    exists: false,
    matchCount: 0,
    lastSaved: null,
  })
  const navigate = useNavigate()
  // Store the submitted PIN so OWNER_VERIFIED handler can use it.
  // The server sends { token: 'owner-session' } which is NOT the PIN.
  const pinRef = useRef('')
  // Store the tournament token for HTTP calls
  const tokenRef = useRef<string | null>(null)

  // Listen for OWNER_VERIFIED and ERROR events from the server
  useEffect(() => {
    if (!socket) return

    const handleOwnerVerified = (data: { token: string; tournamentToken?: string }) => {
      setLoading(false)
      const submittedPin = pinRef.current
      setOwner(true, submittedPin)
      login('owner', undefined, submittedPin)

      // Store tournament token for HTTP calls
      const tToken = data.tournamentToken || ''
      tokenRef.current = tToken
      setTournamentToken(tToken)

      // Check if a prior tournament exists
      setTournamentStatus(prev => ({ ...prev, checking: true }))
      fetch('/api/tournament/status', {
        headers: {
          Authorization: `Bearer ${tToken}`,
        },
      })
        .then(res => res.json())
        .then((status: { exists: boolean; matchCount: number; lastSaved: string | null }) => {
          setTournamentStatus({
            checking: false,
            exists: status.exists ?? false,
            matchCount: status.matchCount ?? 0,
            lastSaved: status.lastSaved ?? null,
          })
          // If no tournament exists, go straight to dashboard
          if (!status.exists) {
            navigate(Routes.DASHBOARD_OWNER)
          }
        })
        .catch(() => {
          // If status check fails, proceed to dashboard
          setTournamentStatus({
            checking: false,
            exists: false,
            matchCount: 0,
            lastSaved: null,
          })
          navigate(Routes.DASHBOARD_OWNER)
        })
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
  }, [socket, login, navigate, setOwner, setTournamentToken])

  // Resolve tournament status — user clicked Load or New
  const resolveTournament = useCallback(
    async (action: 'load' | 'new') => {
      const token = tokenRef.current
      if (!token) {
        navigate(Routes.DASHBOARD_OWNER)
        return
      }

      const endpoint = action === 'load' ? '/api/tournament/load' : '/api/tournament/new'

      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch {
        // If the call fails, still proceed to dashboard — server may be slow
      }

      navigate(Routes.DASHBOARD_OWNER)
    },
    [navigate],
  )

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

  return { submitPin, error, loading, clearError, tournamentStatus, resolveTournament }
}

/**
 * Validate owner PIN has exactly 8 numeric digits.
 */
function validateOwnerPin(pin: string): boolean {
  return /^\d{8}$/.test(pin)
}
