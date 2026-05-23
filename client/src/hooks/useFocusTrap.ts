import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus within a container element.
 *
 * - When `isActive` is true, Tab/Shift+Tab cycle between the first and last
 *   focusable elements inside the container.
 * - Escape key fires the optional `onClose` callback.
 * - On deactivation, focus is restored to the element that was focused before
 *   the trap was activated.
 *
 * @param containerRef - Ref to the container element that should trap focus.
 * @param isActive      - Whether the focus trap is currently active.
 * @param onClose       - Optional callback fired when Escape is pressed.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onClose?: () => void,
): void {
  // Store the element that had focus before activation
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) {
      // Restore focus to previously focused element on deactivation
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
      return
    }

    // Save the currently focused element before trapping
    previousFocusRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    if (!container) return

    function getFocusableElements(): HTMLElement[] {
      return Array.from(
        container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const firstFocusable = focusable[0]
      const lastFocusable = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element (or outside), wrap to last
        if (activeElement === firstFocusable || !container!.contains(activeElement)) {
          e.preventDefault()
          lastFocusable.focus()
        }
      } else {
        // Tab: if focus is on last element (or outside), wrap to first
        if (activeElement === lastFocusable || !container!.contains(activeElement)) {
          e.preventDefault()
          firstFocusable.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)

      // Restore focus when the effect cleanup runs (deactivation)
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [isActive, containerRef, onClose])
}
