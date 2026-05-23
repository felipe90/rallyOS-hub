import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResponsiveQrSize } from './useResponsiveQrSize'

describe('useResponsiveQrSize', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1024)
    window.innerWidth = 1024
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a value between 80 and 160 based on 5% of viewport width', () => {
    // 1024 * 0.05 = 51.2 → floor 51 → max(51, 80) = 80 → min(80, 160) = 80
    const { result } = renderHook(() => useResponsiveQrSize())
    expect(result.current).toBe(80)
  })

  it('clamps to minimum 80px when viewport is small (e.g., 320px phone)', () => {
    window.innerWidth = 320
    // 320 * 0.05 = 16 → floor 16 → max(16, 80) = 80 → min(80, 160) = 80
    const { result } = renderHook(() => useResponsiveQrSize())
    expect(result.current).toBe(80)
  })

  it('clamps to maximum 160px when viewport is large (e.g., 3840px)', () => {
    window.innerWidth = 3840
    // 3840 * 0.05 = 192 → floor 192 → max(192, 80) = 192 → min(192, 160) = 160
    const { result } = renderHook(() => useResponsiveQrSize())
    expect(result.current).toBe(160)
  })

  it('computes intermediate value at 2000px viewport', () => {
    window.innerWidth = 2000
    // 2000 * 0.05 = 100 → floor 100 → max(100, 80) = 100 → min(100, 160) = 100
    const { result } = renderHook(() => useResponsiveQrSize())
    expect(result.current).toBe(100)
  })

  it('responds to window resize events', () => {
    window.innerWidth = 1024
    const { result } = renderHook(() => useResponsiveQrSize())
    expect(result.current).toBe(80)

    // Resize to 2000px → 100
    act(() => {
      window.innerWidth = 2000
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(100)
  })

  it('cleans up resize listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useResponsiveQrSize())
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })
})
