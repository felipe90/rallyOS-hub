/**
 * Scoreboard URL hook
 * Extracts PIN from URL search params (?pin=...)
 *
 * Side-effect: cleans the URL after extracting the PIN to avoid
 * leaving sensitive data in the browser address bar.
 *
 * Note: PIN encryption/decryption is handled server-side only.
 * The ENCRYPTION_SECRET never leaves the server.
 */

import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

export interface ScoreboardUrlState {
  pin: string | null
  isValidPin: boolean
}

/**
 * Hook to parse PIN from URL search params.
 * Also handles the side-effect of cleaning the URL (removing pin after use).
 */
export function useScoreboardUrl(tableId: string | undefined): ScoreboardUrlState {
  const [searchParams] = useSearchParams()
  const [pin, setPin] = useState<string | null>(null)
  const [isValidPin, setIsValidPin] = useState(false)

  const rawPin = searchParams.get('pin')

  useEffect(() => {
    if (!tableId || !rawPin) {
      setPin(null)
      setIsValidPin(false)
      return
    }

    // Validate it's a 4-digit number
    if (/^\d{4}$/.test(rawPin)) {
      setPin(rawPin)
      setIsValidPin(true)
      // Clean URL — remove pin param after extraction
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      setPin(null)
      setIsValidPin(false)
    }
  }, [rawPin, tableId])

  return {
    pin,
    isValidPin,
  }
}
