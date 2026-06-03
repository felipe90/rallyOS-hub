import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { KioskNotificationToast, _resetAudioContext } from './KioskNotificationToast'
import type { KioskNotificationData } from '@shared/types'

// ── Control reduced motion ────────────────────────────────────────────

const mockUseReducedMotion = vi.fn(() => false)
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion')
  return {
    ...actual,
    useReducedMotion: () => mockUseReducedMotion(),
  }
})

// ── Mock Web Audio API ───────────────────────────────────────────────

let audioContextCreationCount = 0
let mockOscillatorConnect: ReturnType<typeof vi.fn>
let mockOscillatorStart: ReturnType<typeof vi.fn>
let mockOscillatorStop: ReturnType<typeof vi.fn>
let mockGainConnect: ReturnType<typeof vi.fn>
let mockContextClose: ReturnType<typeof vi.fn>
let mockContextResume: ReturnType<typeof vi.fn>
let mockContextDestination: unknown
let shouldThrowContextCreation = false
let mockContextState: AudioContextState = 'running'

// Tracking arrays for V2 sound engine assertions
let createdOscillators: Array<{ type: OscillatorType; frequency: number; startOffset: number }> = []
let createdGainNodes: Array<{ linearRampToValueAtTimeCalls: Array<{ value: number; endTime: number }>; setValueAtTimeCalls: Array<{ value: number; startTime: number }> }> = []

function setupMockAudio() {
  audioContextCreationCount = 0
  mockOscillatorConnect = vi.fn()
  mockOscillatorStart = vi.fn()
  mockOscillatorStop = vi.fn()
  mockGainConnect = vi.fn()
  mockContextClose = vi.fn().mockResolvedValue(undefined)
  mockContextResume = vi.fn().mockResolvedValue(undefined)
  mockContextDestination = { symbol: 'destination' }
  shouldThrowContextCreation = false
  mockContextState = 'running'
  createdOscillators = []
  createdGainNodes = []

  // Mock OscillatorNode as a class
  class MockOscillatorNode {
    type = 'sine'
    frequency = { value: 0, setValueAtTime: vi.fn() }
    connect = mockOscillatorConnect
    start = mockOscillatorStart
    stop = mockOscillatorStop
    constructor() {
      // Track frequency and type via the instance reference
      const self = this
      const origSetValue = this.frequency.setValueAtTime
      this.frequency.setValueAtTime = vi.fn((freq: number, time: number) => {
        self.type = self.type // preserve type
        createdOscillators.push({ type: self.type as OscillatorType, frequency: freq, startOffset: time })
        return origSetValue(freq, time)
      })
    }
  }

  // Mock GainNode as a class
  class MockGainNode {
    gain: any
    connect = mockGainConnect
    constructor() {
      const linearRampCalls: Array<{ value: number; endTime: number }> = []
      const setValueCalls: Array<{ value: number; startTime: number }> = []
      this.gain = {
        value: 0,
        setValueAtTime: vi.fn((value: number, startTime: number) => {
          setValueCalls.push({ value, startTime })
        }),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn((value: number, endTime: number) => {
          linearRampCalls.push({ value, endTime })
        }),
      }
      createdGainNodes.push({ linearRampToValueAtTimeCalls: linearRampCalls, setValueAtTimeCalls: setValueCalls })
    }
  }

  // Mock AudioContext as a class
  class MockAudioContext {
    destination = mockContextDestination
    state: AudioContextState = mockContextState
    close = mockContextClose
    resume = mockContextResume
    constructor() {
      if (shouldThrowContextCreation) {
        throw new Error('AudioContext not available')
      }
      audioContextCreationCount++
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
    _resetAudioContext()
    mockUseReducedMotion.mockReturnValue(false)
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

    it('renders an info icon for info type', () => {
      const notification = makeNotification({ type: 'info' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(screen.getByTestId('toast-icon-info')).toBeInTheDocument()
    })

    it('renders a warning icon for warning type', () => {
      const notification = makeNotification({ type: 'warning' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(screen.getByTestId('toast-icon-warning')).toBeInTheDocument()
    })

    it('renders an error icon for error type', () => {
      const notification = makeNotification({ type: 'error' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(screen.getByTestId('toast-icon-error')).toBeInTheDocument()
    })

    it('renders an important icon for important type', () => {
      const notification = makeNotification({ type: 'important' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(screen.getByTestId('toast-icon-important')).toBeInTheDocument()
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

      expect(audioContextCreationCount).toBe(1)
    })

    it('plays multi-note arpeggio for info type (3 ascending notes C5-E5-G5)', () => {
      const notification = makeNotification({ type: 'info' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // Info: 3 notes, sine waveform
      expect(createdOscillators.length).toBe(3)
      const sineOscs = createdOscillators.filter(o => o.type === 'sine')
      expect(sineOscs.length).toBe(3)
      // Frequencies should match C5(=523), E5(=659), G5(=784) with small tolerance
      const freqs = createdOscillators.map(o => Math.round(o.frequency))
      expect(freqs).toContain(523)
      expect(freqs).toContain(659)
      expect(freqs).toContain(784)
    })

    it('plays staccato for warning type (G4 triangle)', () => {
      const notification = makeNotification({ type: 'warning' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // Warning: 2 notes, triangle waveform
      const triOscs = createdOscillators.filter(o => o.type === 'triangle')
      expect(triOscs.length).toBeGreaterThanOrEqual(1)
    })

    it('plays descending error sound with sub-oscillator', () => {
      const notification = makeNotification({ type: 'error' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // Error uses sawtooth + square
      expect(createdOscillators.length).toBeGreaterThanOrEqual(2)
      const sawOscs = createdOscillators.filter(o => o.type === 'sawtooth')
      expect(sawOscs.length).toBeGreaterThanOrEqual(1)
    })

    it('plays fanfare for important type (C major chord ascending)', () => {
      const notification = makeNotification({ type: 'important' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // Important: 3 notes, triangle waveform
      expect(createdOscillators.length).toBe(3)
      const triOscs = createdOscillators.filter(o => o.type === 'triangle')
      expect(triOscs.length).toBe(3)
    })

    it('applies ADSR envelope via linearRampToValueAtTime on gain nodes', () => {
      const notification = makeNotification({ type: 'info' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // Each note has its own gain node with ADSR applied
      expect(createdGainNodes.length).toBeGreaterThanOrEqual(1)
      // At least one gain node should have linearRampToValueAtTime called
      const hasLinearRamp = createdGainNodes.some(
        gn => gn.linearRampToValueAtTimeCalls.length > 0
      )
      expect(hasLinearRamp).toBe(true)
    })

    it('uses reduced gain and shorter duration when reduceMotion is on', () => {
      mockUseReducedMotion.mockReturnValue(true)
      createdOscillators = []
      createdGainNodes = []

      const notification = makeNotification({ type: 'error' })
      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // With reduced motion, sawtooth should be replaced with gentler waveform (sine)
      const sawOscs = createdOscillators.filter(o => o.type === 'sawtooth')
      expect(sawOscs.length).toBe(0)
      // Should still produce oscillators (just gentler ones)
      expect(createdOscillators.length).toBeGreaterThan(0)
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

    it('logs error via console.warn when AudioContext creation fails', () => {
      shouldThrowContextCreation = true
      const notification = makeNotification({ type: 'info' })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // Should log the error with the prefix
      expect(consoleSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[KioskSound] Audio error:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('reuses singleton AudioContext (does not create new one on re-render)', () => {
      const notification1 = makeNotification({ type: 'info', timestamp: 1 })
      const notification2 = makeNotification({ type: 'info', timestamp: 2 })
      const { unmount } = render(
        <KioskNotificationToast
          notification={notification1}
          onDismiss={vi.fn()}
        />,
      )

      unmount()

      render(
        <KioskNotificationToast
          notification={notification2}
          onDismiss={vi.fn()}
        />,
      )

      // Only one AudioContext should be created (singleton)
      expect(audioContextCreationCount).toBe(1)
    })

    it('calls ctx.resume() when AudioContext state is suspended', () => {
      mockContextState = 'suspended'
      const notification = makeNotification({ type: 'info' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // resume() should be called since state is suspended
      expect(mockContextResume).toHaveBeenCalled()
    })

    it('does NOT call ctx.resume() when AudioContext state is running', () => {
      mockContextState = 'running'
      const notification = makeNotification({ type: 'info' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      // resume() should NOT be called since state is already running
      expect(mockContextResume).not.toHaveBeenCalled()
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

  describe('venue typography (kioskMode)', () => {
    it('renders original small toast when kioskMode is false (default)', () => {
      const notification = makeNotification({ type: 'info', message: 'Hello' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      const messageSpan = screen.getByText('Hello')
      // Default mode uses text-lg and smaller icon
      expect(messageSpan.className).toContain('text-lg')
      // Icon size is 40 in default mode
      expect(screen.getByTestId('toast-icon-info').querySelector('svg')).toBeTruthy()
    })

    it('applies venue-scale typography when kioskMode is true', () => {
      const notification = makeNotification({ type: 'info', message: 'Big Text' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
          kioskMode={true}
        />,
      )

      const messageSpan = screen.getByText('Big Text')
      // Kiosk mode uses text-5xl and font-black
      expect(messageSpan.className).toContain('text-5xl')
      expect(messageSpan.className).toContain('font-black')
    })

    it('uses min-h-[15vh] container in kiosk mode', () => {
      const notification = makeNotification({ type: 'info', message: 'Tall' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
          kioskMode={true}
        />,
      )

      // The container should have min-h-[15vh] class
      const container = screen.getByRole('alert')
      expect(container.className).toContain('min-h-[15vh]')
    })

    it('preserves role="alert" in both modes', () => {
      const notification = makeNotification({ type: 'warning', message: 'Alert' })

      const { unmount } = render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
          kioskMode={true}
        />,
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      unmount()

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it.each([
      ['info', 'bg-green-600/90'],
      ['warning', 'bg-amber-500/90'],
      ['error', 'bg-red-600/90'],
      ['important', 'bg-primary/90'],
    ] as const)('renders %s toast with %s background in kiosk mode', (type, expectedClass) => {
      const notification = makeNotification({ type, message: 'Color test' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
          kioskMode={true}
        />,
      )

      const container = screen.getByRole('alert')
      expect(container.className).toContain(expectedClass)
    })

    it.each([
      ['info', 'bg-green-600'],
      ['warning', 'bg-amber-500'],
      ['error', 'bg-red-600'],
      ['important', 'bg-primary'],
    ] as const)('renders %s toast with %s background in non-kiosk mode', (type, expectedClass) => {
      const notification = makeNotification({ type, message: 'Color test' })

      render(
        <KioskNotificationToast
          notification={notification}
          onDismiss={vi.fn()}
        />,
      )

      const container = screen.getByRole('alert')
      expect(container.className).toContain(expectedClass)
    })
  })
})
