/**
 * useClubTimer — Local real-time session timer for club mode
 *
 * Spec requirement: Server-Authoritative Timer
 *   - The server calculates elapsedSeconds authoritatively.
 *   - The CLIENT display SHOULD compute its own local elapsed from
 *     `sessionStart` for real-time display (ticks once per second).
 *   - The client MUST NOT send elapsed values to the server.
 *   - Server MAY emit CLUB_SESSION_TIMER periodically with `elapsedSeconds`
 *     to re-sync; the local counter re-anchors to absorb clock drift.
 *
 * Hook surface:
 *   - sessionStart (epoch ms `Date.now()`) - the court's occupiedAt
 *   - elapsedSeconds - local counter, ticks every 1s while sessionStart != null
 *   - formatted - "MM:SS" or "HH:MM:SS" once elapsed >= 1 hour
 *   - resync(serverElapsedSeconds) - re-anchor to absorb drift
 *   - reset() - clear anchor and stop ticking (used when the session ends)
 *
 * The pure formatter `formatElapsed` is exported so PR 4 components can
 * format `elapsedSeconds` from server sync events without recomputing.
 */

import { useCallback, useEffect, useState } from 'react'

export interface UseClubTimerOptions {
  /** Epoch ms when the court transitioned to OCCUPIED. `null` = no active session. */
  sessionStart: number | null
  /** Tick interval in ms. Defaults to 1000 (1 second). */
  syncIntervalMs?: number
}

export interface UseClubTimerResult {
  /** Local elapsed seconds since sessionStart (0 if no active session). */
  elapsedSeconds: number
  /** "MM:SS" or "HH:MM:SS" (once elapsed >= 1 hour). */
  formatted: string
  /** Re-anchor the local counter to a server-authoritative elapsed value. */
  resync: (serverElapsedSeconds: number) => void
  /** Clear the anchor and stop ticking (called when the session ends). */
  reset: () => void
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * Pure formatter for elapsed seconds. Exposed so PR 4 components can format
 * server-authoritative `elapsedSeconds` (from CLUB_SESSION_TIMER or
 * CLUB_END_SESSION_CONFIRM) without recomputing the local counter.
 *
 * - 0..3599 → "MM:SS"
 * - >= 3600 → "HH:MM:SS"
 * - negative inputs clamp to "00:00"
 * - fractional seconds floored
 */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours >= 1) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  }
  return `${pad2(minutes)}:${pad2(seconds)}`
}

export function useClubTimer(options: UseClubTimerOptions): UseClubTimerResult {
  const { sessionStart, syncIntervalMs = 1000 } = options
  // Anchor is the timestamp used to compute elapsed. Tracking it in state
  // (rather than always using the prop) lets `resync` re-anchor without
  // touching the caller's sessionStart prop.
  const [anchor, setAnchor] = useState<number | null>(sessionStart)
  // forceTick re-renders the hook every interval so `elapsedSeconds` reflects
  // the latest wall-clock without storing it directly in state.
  const [, forceTick] = useState(0)

  // Re-anchor when the caller's sessionStart prop changes (e.g., the parent
  // received CLUB_RECONNECT_RESULT / a new occupiedAt).
  useEffect(() => {
    setAnchor(sessionStart)
  }, [sessionStart])

  // Tick once per second while an anchor is active.
  // (anchor == null) is fine as a dep — it never flips back and forth; only
  // the boolean presence matters and a state setter is stable.
  useEffect(() => {
    if (anchor == null) return
    const id = setInterval(() => {
      forceTick((n) => (n + 1) & 0xffff)
    }, syncIntervalMs)
    return () => clearInterval(id)
  }, [anchor === null, syncIntervalMs])

  const elapsedSeconds =
    anchor == null ? 0 : Math.max(0, Math.floor((Date.now() - anchor) / 1000))
  const formatted = formatElapsed(elapsedSeconds)

  const resync = useCallback((serverElapsedSeconds: number) => {
    if (
      typeof serverElapsedSeconds !== 'number' ||
      !Number.isFinite(serverElapsedSeconds) ||
      serverElapsedSeconds < 0
    ) {
      // Reject bad server payloads — never let garbage re-anchor the timer.
      return
    }
    const safe = Math.floor(serverElapsedSeconds)
    setAnchor(Date.now() - safe * 1000)
  }, [])

  const reset = useCallback(() => {
    setAnchor(null)
  }, [])

  return { elapsedSeconds, formatted, resync, reset }
}