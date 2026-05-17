import { useState, useEffect, useRef, useCallback } from 'react'

export interface WakeLockState {
  isSupported: boolean
  isActive: boolean
}

export function useWakeLock(): WakeLockState {
  const [isSupported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator)
  const [isActive, setIsActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const acquire = useCallback(async () => {
    try {
      // Release existing sentinel before requesting a new one
      if (sentinelRef.current) {
        await sentinelRef.current.release()
        sentinelRef.current = null
      }
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setIsActive(true)
    } catch {
      setIsActive(false)
    }
  }, [])

  useEffect(() => {
    if (!isSupported) return

    acquire()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquire()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (sentinelRef.current) {
        sentinelRef.current.release()
        sentinelRef.current = null
      }
    }
  }, [isSupported, acquire])

  return { isSupported, isActive }
}
