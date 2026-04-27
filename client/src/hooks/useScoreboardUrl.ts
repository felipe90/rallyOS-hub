/**
 * Scoreboard URL hook
 * Extracts and decrypts PIN from URL search params (?ePin=...)
 *
 * This hook has been refactored:
 * - Pure parsing logic moved to services/permissions/rules/url.ts
 * - This hook only handles React lifecycle (useState, useEffect, URL cleanup)
 *
 * Returns:
 * - tableId: from URL params (passed separately, not from useParams here)
 * - ePin: raw encrypted PIN string from URL
 * - decryptedPin: the decrypted PIN if valid, null otherwise
 * - isValidPin: true if decrypted pin matches /^\d{4}$/
 */

import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { parseEncryptedPin } from '@/services/permissions/rules/url'

export interface ScoreboardUrlState {
  ePin: string | null
  decryptedPin: string | null
  isValidPin: boolean
  isDecrypting: boolean
}

/**
 * Hook to parse and decrypt the PIN from URL search params.
 * Also handles the side-effect of cleaning the URL (removing ePin after use).
 */
export function useScoreboardUrl(tableId: string | undefined): ScoreboardUrlState {
  const [searchParams] = useSearchParams()
  const [decryptedPin, setDecryptedPin] = useState<string | null>(null)
  const [isValidPin, setIsValidPin] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)

  const ePin = searchParams.get('ePin')

  useEffect(() => {
    if (!tableId || !ePin) {
      setDecryptedPin(null)
      setIsValidPin(false)
      setIsDecrypting(false)
      return
    }

    let cancelled = false
    setIsDecrypting(true)

    // Use pure function from services (async)
    parseEncryptedPin(ePin, tableId).then((result) => {
      if (cancelled) return

      if (result.isValid) {
        setDecryptedPin(result.pin)
        setIsValidPin(true)
        // Clean URL — remove ePin param after successful decryption
        window.history.replaceState({}, '', window.location.pathname)
      } else {
        setDecryptedPin(null)
        setIsValidPin(false)
      }
      setIsDecrypting(false)
    }).catch(() => {
      if (cancelled) return
      setDecryptedPin(null)
      setIsValidPin(false)
      setIsDecrypting(false)
    })

    return () => {
      cancelled = true
    }
  }, [ePin, tableId])

  return {
    ePin,
    decryptedPin,
    isValidPin,
    isDecrypting,
  }
}
