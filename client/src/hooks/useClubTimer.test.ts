import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClubTimer, formatElapsed } from './useClubTimer'

/**
 * useClubTimer — RED phase tests for PR 3.
 *
 * Spec coverage:
 *   - Local `elapsed` counter computed from a `sessionStart` timestamp
 *   - 1s tick
 *   - MM:SS formatting / HH:MM:SS rollover once 60 minutes elapse
 *   - resync(serverElapsed) to correct drift from server sync (CLUB_SESSION_TIMER,
 *     CLUB_RECONNECT_RESULT)
 *   - reset()
 *   - Boundary: 59:59 → 01:00:00 rollover
 *   - Initial null sessionStart (shows 00:00)
 */

describe('formatElapsed — pure formatter', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatElapsed(0)).toBe('00:00')
  })

  it('formats single-digit seconds as MM:SS with leading zero', () => {
    expect(formatElapsed(5)).toBe('00:05')
  })

  it('formats seconds-only without minutes as 00:SS', () => {
    expect(formatElapsed(42)).toBe('00:42')
  })

  it('formats minutes and seconds as MM:SS', () => {
    expect(formatElapsed(65)).toBe('01:05')
  })

  it('formats 9:59 exactly', () => {
    expect(formatElapsed(599)).toBe('09:59')
  })

  it('formats 59:59 boundary (just below the HH rollover)', () => {
    expect(formatElapsed(59 * 60 + 59)).toBe('59:59')
  })

  it('rolls over to HH:MM:SS at exactly 1 hour', () => {
    expect(formatElapsed(3600)).toBe('01:00:00')
  })

  it('formats 1 hour, 1 minute, 1 second as 01:01:01', () => {
    expect(formatElapsed(3661)).toBe('01:01:01')
  })

  it('formats multi-hour durations as HH:MM:SS', () => {
    expect(formatElapsed(5 * 3600 + 30 * 60 + 15)).toBe('05:30:15')
  })

  it('clamps negative inputs to 00:00', () => {
    expect(formatElapsed(-10)).toBe('00:00')
  })

  it('floors fractional seconds', () => {
    expect(formatElapsed(3.9)).toBe('00:03')
  })
})

describe('useClubTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 00:00 / 0 elapsed when sessionStart is null', () => {
    const { result } = renderHook(() => useClubTimer({ sessionStart: null }))

    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.formatted).toBe('00:00')
  })

  it('computes elapsed from sessionStart at mount', () => {
    const now = Date.now()
    const { result } = renderHook(() => useClubTimer({ sessionStart: now - 5000 }))

    expect(result.current.elapsedSeconds).toBe(5)
    expect(result.current.formatted).toBe('00:05')
  })

  it('ticks up by 1 second each interval', () => {
    const now = Date.now()
    const { result } = renderHook(() => useClubTimer({ sessionStart: now - 5000 }))
    expect(result.current.elapsedSeconds).toBe(5)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.elapsedSeconds).toBe(6)

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(result.current.elapsedSeconds).toBe(10)
    expect(result.current.formatted).toBe('00:10')
  })

  it('does not tick when sessionStart is null', () => {
    const { result } = renderHook(() => useClubTimer({ sessionStart: null }))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.elapsedSeconds).toBe(0)
  })

  it('rolls formatted from 59:59 → 01:00:00 across the 60-minute boundary', () => {
    const now = Date.now()
    // session started 59:59 ago
    const { result } = renderHook(() => useClubTimer({ sessionStart: now - (59 * 60 + 59) * 1000 }))
    expect(result.current.formatted).toBe('59:59')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.elapsedSeconds).toBe(3600)
    expect(result.current.formatted).toBe('01:00:00')
  })

  it('re-anchors when a new non-null sessionStart is passed', () => {
    const now = Date.now()
    let start = now - 3000
    const { result, rerender } = renderHook(({ s }) => useClubTimer({ sessionStart: s }), {
      initialProps: { s: start },
    })
    expect(result.current.elapsedSeconds).toBe(3)

    // Server reports a new sessionStart further in the past
    start = now - 6000
    rerender({ s: start })

    // After re-anchor, elapsed should reflect the new sessionStart at the
    // same wall-clock time (now has not advanced).
    expect(result.current.elapsedSeconds).toBe(6)
  })

  it('resync(serverElapsed) overrides drift by re-anchoring to now - serverElapsed', () => {
    const now = Date.now()
    // Client anchor says 1000s elapsed (simulated drift)
    const { result } = renderHook(() => useClubTimer({ sessionStart: now - 1000 * 1000 }))
    expect(result.current.elapsedSeconds).toBe(1000)

    act(() => {
      result.current.resync(30)
    })

    // The new anchor places the session 30 seconds in the past relative to
    // the current wall-clock — drift corrected.
    expect(result.current.elapsedSeconds).toBe(30)
    expect(result.current.formatted).toBe('00:30')
  })

  it('ignores non-finite resync values', () => {
    const now = Date.now()
    const { result } = renderHook(() => useClubTimer({ sessionStart: now - 5000 }))
    const before = result.current.elapsedSeconds

    act(() => {
      // @ts-expect-error: guarding runtime garbage from server payloads
      result.current.resync(NaN)
      // @ts-expect-error: same
      result.current.resync('not a number')
      result.current.resync(-1)
    })

    // Anchor unchanged
    expect(result.current.elapsedSeconds).toBe(before)
  })

  it('resync(0) re-anchors the session to "just started"', () => {
    const { result } = renderHook(() => useClubTimer({ sessionStart: Date.now() - 5000 }))
    expect(result.current.elapsedSeconds).toBe(5)

    act(() => {
      result.current.resync(0)
    })

    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.formatted).toBe('00:00')
  })

  it('reset() clears the anchor and freezes elapsed at 0', () => {
    const { result } = renderHook(() => useClubTimer({ sessionStart: Date.now() - 3000 }))
    expect(result.current.elapsedSeconds).toBe(3)

    act(() => {
      result.current.reset()
    })

    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.formatted).toBe('00:00')

    // No further ticking after reset
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(result.current.elapsedSeconds).toBe(0)
  })

  it('cleans up the interval on unmount', () => {
    const clearSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = renderHook(() => useClubTimer({ sessionStart: Date.now() }))

    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})