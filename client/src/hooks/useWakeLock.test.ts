import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWakeLock } from './useWakeLock'

describe('useWakeLock', () => {
  let mockSentinel: { release: ReturnType<typeof vi.fn> }
  let mockRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSentinel = { release: vi.fn().mockResolvedValue(undefined) }
    mockRequest = vi.fn().mockResolvedValue(mockSentinel)

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Restore navigator to pristine state (wakeLock was undefined in jsdom)
    delete (navigator as any).wakeLock
    // Restore visibilityState to default (jsdom default is 'visible')
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  // Task 1.1: mock request returning sentinel, verify isActive: true on mount
  it('requests wake lock on mount and returns isActive as true', async () => {
    const { result } = renderHook(() => useWakeLock())

    expect(result.current.isSupported).toBe(true)

    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })

    expect(mockRequest).toHaveBeenCalledWith('screen')
  })

  // Task 1.2: sentinel.release() called on unmount
  it('releases wake lock on unmount', async () => {
    const { result, unmount } = renderHook(() => useWakeLock())

    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })

    unmount()

    expect(mockSentinel.release).toHaveBeenCalled()
  })

  // Task 1.3: re-acquire on visibilitychange (document.hidden → visible)
  it('re-acquires wake lock on visibilitychange when becoming visible', async () => {
    const { result } = renderHook(() => useWakeLock())

    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })

    // Reset call counts from initial mount
    mockRequest.mockClear()
    mockSentinel.release.mockClear()

    // Simulate page becoming visible (re-trigger via visibilitychange)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith('screen')
    })
  })

  // Task 1.4: graceful no-op when navigator.wakeLock is undefined
  it('gracefully degrades when navigator.wakeLock is unavailable', () => {
    delete (navigator as any).wakeLock

    const { result } = renderHook(() => useWakeLock())

    expect(result.current.isSupported).toBe(false)
    expect(result.current.isActive).toBe(false)
  })

  // Triangulation: visibilitychange when hidden must NOT trigger re-acquire
  it('does not re-acquire wake lock when visibilitychange fires while hidden', async () => {
    const { result } = renderHook(() => useWakeLock())

    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })

    mockRequest.mockClear()

    // Override visibilityState to 'hidden' and dispatch event
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Handler should skip acquire when hidden
    expect(mockRequest).not.toHaveBeenCalled()

    // Restore visibilityState for subsequent tests
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  // Task 1.5: request() rejection sets isActive: false without throwing
  it('sets isActive to false without throwing when request rejects', async () => {
    mockRequest.mockRejectedValue(new Error('Wake lock denied'))

    const { result } = renderHook(() => useWakeLock())

    expect(result.current.isSupported).toBe(true)

    await waitFor(() => {
      expect(result.current.isActive).toBe(false)
    })
  })
})
