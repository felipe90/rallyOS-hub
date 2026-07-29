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
    expect(screen.getAllByText('Court 4 ready')).toHaveLength(2)
  })

  it('renders defaultText when no notification', () => {
    render(<KioskSportsTicker defaultText="Welcome to RallyOS" />)
    expect(screen.getAllByText('Welcome to RallyOS')).toHaveLength(2)
  })

  it('renders default text when notification is null', () => {
    render(<KioskSportsTicker notification={null} defaultText="No notifications" />)
    expect(screen.getAllByText('No notifications')).toHaveLength(2)
  })

  // ── Task 3.1: Priority/duration logic ──────────────────────────────

  describe('priority / duration logic (task 3.1)', () => {
    it('shows important notification immediately', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'URGENT' })}
        />,
      )
      expect(screen.getAllByText('URGENT')).toHaveLength(2)
    })

    it('shows error notification immediately', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'error', message: 'ERROR' })}
        />,
      )
      expect(screen.getAllByText('ERROR')).toHaveLength(2)
    })

    it('important notification persists after duration elapses (does not auto-expire)', () => {
      const { rerender } = render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'PERSIST', duration: 5 })}
          defaultText="Default"
        />,
      )
      expect(screen.getAllByText('PERSIST')).toHaveLength(2)

      // Advance beyond duration
      act(() => { vi.advanceTimersByTime(10_000) })

      // Should still show the important notification
      expect(screen.getAllByText('PERSIST')).toHaveLength(2)
    })

    it('error notification persists after duration elapses (does not auto-expire)', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'error', message: 'PERSIST ERROR', duration: 5 })}
          defaultText="Default"
        />,
      )
      expect(screen.getAllByText('PERSIST ERROR')).toHaveLength(2)

      act(() => { vi.advanceTimersByTime(10_000) })

      expect(screen.getAllByText('PERSIST ERROR')).toHaveLength(2)
    })

    it('info notification auto-expires after duration', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'info', message: 'Will expire', duration: 5 })}
          defaultText="Default"
        />,
      )

      expect(screen.getAllByText('Will expire')).toHaveLength(2)

      act(() => { vi.advanceTimersByTime(5_000) })

      expect(screen.queryAllByText('Will expire')).toHaveLength(0)
      expect(screen.getAllByText('Default')).toHaveLength(2)
    })

    it('warning notification auto-expires after duration', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'warning', message: 'Warning msg', duration: 3 })}
          defaultText="Default"
        />,
      )

      expect(screen.getAllByText('Warning msg')).toHaveLength(2)

      act(() => { vi.advanceTimersByTime(3_000) })

      expect(screen.queryAllByText('Warning msg')).toHaveLength(0)
    })

    it('does NOT clear info notification before the duration expires', () => {
      render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'info', message: 'Still visible', duration: 10 })}
          defaultText="Default"
        />,
      )

      act(() => { vi.advanceTimersByTime(9_000) })

      expect(screen.getAllByText('Still visible')).toHaveLength(2)
    })

    it('important notification is replaced by a newer notification', () => {
      const { rerender } = render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'First', timestamp: 1000 })}
          defaultText="Default"
        />,
      )
      expect(screen.getAllByText('First')).toHaveLength(2)

      rerender(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'Second', timestamp: 2000 })}
          defaultText="Default"
        />,
      )

      expect(screen.queryAllByText('First')).toHaveLength(0)
      expect(screen.getAllByText('Second')).toHaveLength(2)
    })

    it('clears notification when replaced with null', () => {
      const { rerender } = render(
        <KioskSportsTicker
          notification={makeNotification({ type: 'important', message: 'Gone', duration: 5 })}
          defaultText="Default"
        />,
      )
      expect(screen.getAllByText('Gone')).toHaveLength(2)

      rerender(
        <KioskSportsTicker
          notification={null}
          defaultText="Default"
        />,
      )

      expect(screen.queryAllByText('Gone')).toHaveLength(0)
      expect(screen.getAllByText('Default')).toHaveLength(2)
    })
  })

  // ── Task 3.1: defaultTexts rotation ────────────────────────────────

  describe('defaultTexts rotation (task 3.1)', () => {
    it('rotates through defaultTexts array every 10 seconds when no notification', () => {
      const texts = ['Court status', 'Reservations', 'QR reminder']
      render(<KioskSportsTicker defaultTexts={texts} />)

      // Initially shows first item
      expect(screen.getAllByText('Court status')).toHaveLength(2)

      // Advance 10s → second item
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(screen.queryAllByText('Court status')).toHaveLength(0)
      expect(screen.getAllByText('Reservations')).toHaveLength(2)

      // Advance 10s → third item
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(screen.getAllByText('QR reminder')).toHaveLength(2)

      // Advance 10s → wraps back to first
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(screen.getAllByText('Court status')).toHaveLength(2)
    })

    it('falls back to defaultText when defaultTexts is empty', () => {
      render(<KioskSportsTicker defaultTexts={[]} defaultText="Fallback" />)
      expect(screen.getAllByText('Fallback')).toHaveLength(2)
    })

    it('falls back to defaultText when defaultTexts is not provided', () => {
      render(<KioskSportsTicker defaultText="Single text" />)
      expect(screen.getAllByText('Single text')).toHaveLength(2)
    })

    it('notification interrupts defaultTexts rotation', () => {
      const texts = ['Default 1', 'Default 2']
      const { rerender } = render(
        <KioskSportsTicker defaultTexts={texts} />,
      )
      expect(screen.getAllByText('Default 1')).toHaveLength(2)

      // Send a notification
      rerender(
        <KioskSportsTicker
          defaultTexts={texts}
          notification={makeNotification({ type: 'important', message: 'INTERRUPT', timestamp: Date.now() })}
        />,
      )

      expect(screen.queryAllByText('Default 1')).toHaveLength(0)
      expect(screen.getAllByText('INTERRUPT')).toHaveLength(2)
    })
  })
})
