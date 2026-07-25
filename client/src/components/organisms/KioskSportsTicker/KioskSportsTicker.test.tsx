import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { KioskSportsTicker } from './KioskSportsTicker'
import type { KioskNotificationData } from '@shared/types'

function makeNotification(
  overrides: Partial<KioskNotificationData> = {},
): KioskNotificationData {
  return {
    type: 'info',
    message: 'Test notification',
    duration: 5,
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('KioskSportsTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Basic rendering ────────────────────────────────────────────────

  it('renders notification message when present', () => {
    render(<KioskSportsTicker notification={makeNotification({ message: 'Court 4 ready' })} />)
    expect(screen.getByText('Court 4 ready')).toBeInTheDocument()
  })

  it('renders defaultText when no notification', () => {
    render(<KioskSportsTicker defaultText="Welcome to RallyOS" />)
    expect(screen.getByText('Welcome to RallyOS')).toBeInTheDocument()
  })

  it('renders default text when notification is null', () => {
    render(<KioskSportsTicker notification={null} defaultText="No notifications" />)
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  // ── Task 3.1: Priority/duration logic ──────────────────────────────

  describe('priority / duration logic (task 3.1)', () => {
    it('shows important notification immediately', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'URGENT' })}
        />,
      )
      expect(screen.getByText('URGENT')).toBeInTheDocument()
    })

    it('shows error notification immediately', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'error', message: 'ERROR' })}
        />,
      )
      expect(screen.getByText('ERROR')).toBeInTheDocument()
    })

    it('important notification persists after duration elapses (does not auto-expire)', () => {
      const { rerender } = render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'PERSIST', duration: 5 })}
          defaultText="Default"
        />,
      )
      expect(screen.getByText('PERSIST')).toBeInTheDocument()

      // Advance beyond duration
      act(() => { vi.advanceTimersByTime(10_000) })

      // Should still show the important notification
      expect(screen.getByText('PERSIST')).toBeInTheDocument()
    })

    it('error notification persists after duration elapses (does not auto-expire)', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'error', message: 'PERSIST ERROR', duration: 5 })}
          defaultText="Default"
        />,
      )
      expect(screen.getByText('PERSIST ERROR')).toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(10_000) })

      expect(screen.getByText('PERSIST ERROR')).toBeInTheDocument()
    })

    it('info notification auto-expires after duration', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'info', message: 'Will expire', duration: 5 })}
          defaultText="Default"
        />,
      )

      expect(screen.getByText('Will expire')).toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(5_000) })

      expect(screen.queryByText('Will expire')).not.toBeInTheDocument()
      expect(screen.getByText('Default')).toBeInTheDocument()
    })

    it('warning notification auto-expires after duration', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'warning', message: 'Warning msg', duration: 3 })}
          defaultText="Default"
        />,
      )

      expect(screen.getByText('Warning msg')).toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(3_000) })

      expect(screen.queryByText('Warning msg')).not.toBeInTheDocument()
    })

    it('does NOT clear info notification before the duration expires', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'info', message: 'Still visible', duration: 10 })}
          defaultText="Default"
        />,
      )

      act(() => { vi.advanceTimersByTime(9_000) })

      expect(screen.getByText('Still visible')).toBeInTheDocument()
    })

    it('important notification is replaced by a newer notification', () => {
      const { rerender } = render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'First', timestamp: 1000 })}
          defaultText="Default"
        />,
      )
      expect(screen.getByText('First')).toBeInTheDocument()

      rerender(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'Second', timestamp: 2000 })}
          defaultText="Default"
        />,
      )

      expect(screen.queryByText('First')).not.toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
    })

    it('clears notification when replaced with null', () => {
      const { rerender } = render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'Gone', duration: 5 })}
          defaultText="Default"
        />,
      )
      expect(screen.getByText('Gone')).toBeInTheDocument()

      rerender(
        <KioskSportsTicker
          notification={null}
          defaultText="Default"
        />,
      )

      expect(screen.queryByText('Gone')).not.toBeInTheDocument()
      expect(screen.getByText('Default')).toBeInTheDocument()
    })
  })

  // ── Task 3.1: defaultTexts rotation ────────────────────────────────

  describe('defaultTexts rotation (task 3.1)', () => {
    it('rotates through defaultTexts array every 10 seconds when no notification', () => {
      const texts = ['Court status', 'Reservations', 'QR reminder']
      render(<KioskSportsTicker defaultTexts={texts} />)

      // Initially shows first item
      expect(screen.getByText('Court status')).toBeInTheDocument()

      // Advance 10s → second item
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(screen.queryByText('Court status')).not.toBeInTheDocument()
      expect(screen.getByText('Reservations')).toBeInTheDocument()

      // Advance 10s → third item
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(screen.getByText('QR reminder')).toBeInTheDocument()

      // Advance 10s → wraps back to first
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(screen.getByText('Court status')).toBeInTheDocument()
    })

    it('falls back to defaultText when defaultTexts is empty', () => {
      render(<KioskSportsTicker defaultTexts={[]} defaultText="Fallback" />)
      expect(screen.getByText('Fallback')).toBeInTheDocument()
    })

    it('falls back to defaultText when defaultTexts is not provided', () => {
      render(<KioskSportsTicker defaultText="Single text" />)
      expect(screen.getByText('Single text')).toBeInTheDocument()
    })

    it('notification interrupts defaultTexts rotation', () => {
      const texts = ['Default 1', 'Default 2']
      const { rerender } = render(
        <KioskSportsTicker defaultTexts={texts} />,
      )
      expect(screen.getByText('Default 1')).toBeInTheDocument()

      // Send a notification
      rerender(
        <KioskSportsTicker
          defaultTexts={texts}
          notification={makeNotification({ type: 'important', message: 'INTERRUPT', timestamp: Date.now() })}
        />,
      )

      expect(screen.queryByText('Default 1')).not.toBeInTheDocument()
      expect(screen.getByText('INTERRUPT')).toBeInTheDocument()
    })
  })
})
