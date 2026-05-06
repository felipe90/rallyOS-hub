/**
 * usePinSubmission - Reusable PIN submission flow
 *
 * Extracted from OwnerDashboardPage and RefereeDashboardPage (DRY).
 */

import { useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { validateTablePin } from '@/services/validation'

/** Error codes returned by usePinSubmission — callers translate via i18nText() */
export type PinErrorCode =
  | 'NO_CONNECTION'
  | 'INVALID_PIN'
  | 'REF_ASSIGN_FAILED'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | string

export interface PinSubmissionResult {
  success: boolean
  error?: string
}

export function usePinSubmission(socket: Socket | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitPin = useCallback(
    (pin: string, tableId: string): Promise<PinSubmissionResult> => {
      return new Promise((resolve) => {
        if (!socket) {
          const code: PinErrorCode = 'NO_CONNECTION'
          setError(code)
          resolve({ success: false, error: code })
          return
        }

        if (!validateTablePin(pin)) {
          const code: PinErrorCode = 'INVALID_PIN'
          setError(code)
          resolve({ success: false, error: code })
          return
        }

        setLoading(true)
        setError(null)

        const handleResponse = (response: { success?: boolean; tableId?: string }) => {
          cleanup()
          if (response.success || response.tableId) {
            resolve({ success: true })
          } else {
            const code: PinErrorCode = 'REF_ASSIGN_FAILED'
            setError(code)
            resolve({ success: false, error: code })
          }
        }

        const handleError = (err: { code: string; message: string }) => {
          cleanup()
          setError(err.code)
          resolve({ success: false, error: err.code })
        }

        let cleanupCalled = false
        const cleanup = () => {
          if (cleanupCalled) return
          cleanupCalled = true
          clearTimeout(timeoutId)
          socket.off('disconnect', handleDisconnect)
          socket.off(SocketEvents.SERVER.REF_SET, handleResponse)
          socket.off(SocketEvents.SERVER.ERROR, handleError)
          setLoading(false)
        }

        socket.once(SocketEvents.SERVER.REF_SET, handleResponse)
        socket.once(SocketEvents.SERVER.ERROR, handleError)

        socket.emit(SocketEvents.CLIENT.SET_REF, { tableId, pin })

        // Timeout fallback — resolve as FAILURE, never assume success
        const timeoutId = setTimeout(() => {
          cleanup()
          const code: PinErrorCode = 'TIMEOUT'
          setError(code)
          resolve({ success: false, error: code })
        }, 5000)

        // Handle socket disconnect during submission
        const handleDisconnect = () => {
          cleanup()
          const code: PinErrorCode = 'DISCONNECTED'
          setError(code)
          resolve({ success: false, error: code })
        }

        socket.on('disconnect', handleDisconnect)
      })
    },
    [socket],
  )

  const clearError = useCallback(() => setError(null), [])

  return { submitPin, loading, error, clearError }
}
