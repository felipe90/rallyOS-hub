/**
 * usePinSubmission - Reusable PIN submission flow
 *
 * Extracted from OwnerDashboardPage and RefereeDashboardPage (DRY).
 */

import { useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { validateTablePin } from '@/services/validation'

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
          resolve({ success: false, error: 'Sin conexión' })
          return
        }

        if (!validateTablePin(pin)) {
          setError('PIN inválido')
          resolve({ success: false, error: 'PIN inválido' })
          return
        }

        setLoading(true)
        setError(null)

        const handleResponse = (response: { success?: boolean; tableId?: string }) => {
          cleanup()
          if (response.success || response.tableId) {
            resolve({ success: true })
          } else {
            setError('No se pudo asignar el árbitro')
            resolve({ success: false, error: 'No se pudo asignar el árbitro' })
          }
        }

        const handleError = (err: { code: string; message: string }) => {
          cleanup()
          setError(err.message)
          resolve({ success: false, error: err.message })
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
          setError('Tiempo de espera agotado')
          resolve({ success: false, error: 'Timeout' })
        }, 5000)

        // Handle socket disconnect during submission
        const handleDisconnect = () => {
          cleanup()
          setError('Conexión perdida')
          resolve({ success: false, error: 'Disconnected' })
        }

        socket.on('disconnect', handleDisconnect)
      })
    },
    [socket],
  )

  const clearError = useCallback(() => setError(null), [])

  return { submitPin, loading, error, clearError }
}
