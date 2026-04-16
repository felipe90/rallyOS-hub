/**
 * Scoreboard URL hook
 * Extracts and decrypts PIN from URL search params (?ePin=...)
 *
 * The ePin param is base64-encoded as "hex:originalPin" for integrity.
 * This hook decodes the base64, extracts the hex portion, and decrypts
 * it using the daily XOR key.
 *
 * Returns:
 * - tableId: from URL params (passed separately, not from useParams here)
 * - ePin: raw encrypted PIN string from URL
 * - decryptedPin: the decrypted PIN if valid, null otherwise
 * - isValidPin: true if decrypted pin matches /^\d{4}$/
 */

import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { generateKey, decryptPin } from '@/shared/crypto/pinEncryption'

export interface ScoreboardUrlState {
  ePin: string | null
  decryptedPin: string | null
  isValidPin: boolean
}

/**
 * Hook to parse and decrypt the PIN from URL search params.
 * Also handles the side-effect of cleaning the URL (removing ePin after use).
 */
export function useScoreboardUrl(tableId: string | undefined): ScoreboardUrlState {
  const [searchParams] = useSearchParams()
  const [decryptedPin, setDecryptedPin] = useState<string | null>(null)
  const [isValidPin, setIsValidPin] = useState(false)

  const ePin = searchParams.get('ePin')

  useEffect(() => {
    if (!ePin || !tableId) {
      setDecryptedPin(null)
      setIsValidPin(false)
      return
    }

    try {
      const decoded = atob(ePin)
      const parts = decoded.split(':')

      if (parts.length === 2) {
        const [encrypted] = parts
        const key = generateKey(tableId)
        const decrypted = decryptPin(encrypted, key)

        if (/^\d{4}$/.test(decrypted)) {
          setDecryptedPin(decrypted)
          setIsValidPin(true)
          // Clean URL — remove ePin param after successful decryption
          window.history.replaceState({}, '', window.location.pathname)
          return
        }
      }
    } catch {
      // Decryption failed — silently ignore
    }

    setDecryptedPin(null)
    setIsValidPin(false)
  }, [ePin, tableId])

  return {
    ePin,
    decryptedPin,
    isValidPin,
  }
}
