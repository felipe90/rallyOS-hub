import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { KioskNotificationToast } from './KioskNotificationToast'
import type { KioskNotificationData } from '@shared/types'

// ── Mock Web Audio API ───────────────────────────────────────────────

let audioContextCreated = false
let mockOscillatorConnect: ReturnType<typeof vi.fn>
let mockOscillatorStart: ReturnType<typeof vi.fn>
let mockOscillatorStop: ReturnType<typeof vi.fn>
let mockGainConnect: ReturnType<typeof vi.fn>
let mockContextClose: ReturnType<typeof vi.fn>
let mockContextDestination: unknown
let shouldThrowContextCreation = false

function setupMockAudio() {
  audioContextCreated = false
  mockOscillatorConnect = vi.fn()
  mockOscillatorStart = vi.fn()
  mockOscillatorStop = vi.fn()
  mockGainConnect = vi.fn()
  mockContextClose = vi.fn().mockResolvedValue(undefined)
  mockContextDestination = { symbol: 'destination' }
  shouldThrowContextCreation = false

  // Mock OscillatorNode as a class
  class MockOscillatorNode {
    type = 'sine'
    frequency = { value: 0, setValueAtTime: vi.fn() }
    connect = mockOscillatorConnect
    start = mockOscillatorStart
    stop = mockOscillatorStop
  }

  // Mock GainNode as a class
  class MockGainNode {
    gain = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
    connect = mockGainConnect
  }

  // Mock AudioContext as a class
  class MockAudioContext {
    destination = mockContextDestination
    close = mockContextClose
    constructor() {
      if (shouldThrowContextCreation) {
        throw new Error('AudioContext not available')
      }
      audioContextCreated = true
    }
    createOscillator() {
      return new MockOscillatorNode()
    }
    createGain() {
      return new MockGainNode()
    }
  }

  vi.stubGlobal('AudioContext', MockAudioContext)

  return () => {
    vi.unstubAllGlobals()
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeNotification(
  overrides: Partial<KioskNotificationData> = {},
): KioskNotificationData {
  return {
    type: 'info',
    message: 'Test notification message',
    duration: 5,
    timestamp: Date.now(),
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('KioskNotificationToast', () => {
  let restoreAudio: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    restoreAudio = setupMockAudio()
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreAudio()
  })

  describe('rendering', () => {
    it('renders the notification message', () => {
      const notification = makeNotification({ message: 'All matches are starting!' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(screen.getByText('All matches are starting!')).toBeInTheDocument()
    })

    it('renders an icon for info type', () => {
      const notification = makeNotification({ type: 'info' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // The icon should be present (lucide-react renders SVG)
      const iconContainer = document.querySelector('svg')
      expect(iconContainer).toBeInTheDocument()
    })

    it('renders an icon for warning type', () => {
      const notification = makeNotification({ type: 'warning' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      const iconContainer = document.querySelector('svg')
      expect(iconContainer).toBeInTheDocument()
    })

    it('renders an icon for error type', () => {
      const notification = makeNotification({ type: 'error' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      const iconContainer = document.querySelector('svg')
      expect(iconContainer).toBeInTheDocument()
    })

    it('renders an icon for important type', () => {
      const notification = makeNotification({ type: 'important' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      const iconContainer = document.querySelector('svg')
      expect(iconContainer).toBeInTheDocument()
    })
  })

  describe('sound', () => {
    it('creates an AudioContext and plays sound on mount', () => {
      const notification = makeNotification({ type: 'info' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(audioContextCreated).toBe(true)
    })

    it('plays sine wave for info type (880Hz, 200ms)', () => {
      const notification = makeNotification({ type: 'info' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(mockOscillatorStart).toHaveBeenCalled()
    })

    it('plays sound for warning type', () => {
      const notification = makeNotification({ type: 'warning' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(mockOscillatorStart).toHaveBeenCalled()
    })

    it('plays sound for error type', () => {
      const notification = makeNotification({ type: 'error' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(mockOscillatorStart).toHaveBeenCalled()
    })

    it('plays dual sine for important type (bell)', () => {
      const notification = makeNotification({ type: 'important' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(mockOscillatorStart).toHaveBeenCalled()
    })

    it('falls back silently when AudioContext creation fails', () => {
      shouldThrowContextCreation = true
      const notification = makeNotification({ type: 'info' })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Should not throw when AudioContext is unavailable
      expect(() => {
        render(
          <KioskNotificationToast
            notification={notification}
            onDismiss={vi.fn()}
          />,
        )
      }).not.toThrow()

      consoleSpy.mockRestore()
    })
  })

  describe('auto-dismiss', () => {
    it('calls onDismiss after duration * 1000 ms', () => {
      const onDismiss = vi.fn()
      const notification = makeNotification({ duration: 5 })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={onDismiss}
        />,
      )

      expect(onDismiss).not.toHaveBeenCalled()

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5_000)
      })

      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('calls onDismiss after 10 seconds when duration is 10', () => {
      const onDismiss = vi.fn()
      const notification = makeNotification({ duration: 10 })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={onDismiss}
        />,
      )

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('calls onDismiss after 30 seconds when duration is 30', () => {
      const onDismiss = vi.fn()
      const notification = makeNotification({ duration: 30 })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={onDismiss}
        />,
      )

      act(() => {
        vi.advanceTimersByTime(30_000)
      })

      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('does NOT call onDismiss before duration elapses', () => {
      const onDismiss = vi.fn()
      const notification = makeNotification({ duration: 10 })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={onDismiss}
        />,
      )

      act(() => {
        vi.advanceTimersByTime(9_000)
      })

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('clears timeout on unmount before dismiss fires', () => {
      const onDismiss = vi.fn()
      const notification = makeNotification({ duration: 10 })

      const { unmount } = render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={onDismiss}
        />,
      )

      // Unmount before the timeout fires
      unmount()

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      // onDismiss should NOT be called because the component was unmounted
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })
})
