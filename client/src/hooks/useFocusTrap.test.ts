import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

/**
 * Creates a mock container element with focusable children.
 * Returns the container, the focusable elements, and helper to dispatch keyboard events.
 */
function createMockContainer(): {
  container: HTMLDivElement
  firstButton: HTMLButtonElement
  secondButton: HTMLButtonElement
  thirdButton: HTMLButtonElement
  nonFocusable: HTMLSpanElement
} {
  const container = document.createElement('div')
  const firstButton = document.createElement('button')
  firstButton.textContent = 'First'
  const secondButton = document.createElement('button')
  secondButton.textContent = 'Second'
  const thirdButton = document.createElement('button')
  thirdButton.textContent = 'Third'
  const nonFocusable = document.createElement('span')
  nonFocusable.textContent = 'Not focusable'

  container.appendChild(firstButton)
  container.appendChild(secondButton)
  container.appendChild(thirdButton)
  container.appendChild(nonFocusable)
  document.body.appendChild(container)

  return { container, firstButton, secondButton, thirdButton, nonFocusable }
}

function dispatchKeyDown(element: HTMLElement, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  element.dispatchEvent(event)
  return event
}

describe('useFocusTrap', () => {
  let elements: ReturnType<typeof createMockContainer>

  beforeEach(() => {
    elements = createMockContainer()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should do nothing when isActive is false', () => {
    const ref = { current: elements.container }
    const onClose = vi.fn()

    renderHook(() => useFocusTrap(ref, false, onClose))

    // Focus on first element and try Tab — should NOT be trapped
    elements.firstButton.focus()
    expect(document.activeElement).toBe(elements.firstButton)
  })

  it('should cycle Tab from last focusable element back to first', () => {
    const ref = { current: elements.container }
    renderHook(() => useFocusTrap(ref, true))

    // Focus the last focusable button
    elements.thirdButton.focus()
    expect(document.activeElement).toBe(elements.thirdButton)

    // Press Tab on the container
    dispatchKeyDown(elements.container, 'Tab')

    // Should have cycled to the first button
    expect(document.activeElement).toBe(elements.firstButton)
  })

  it('should cycle Tab from last focusable element back to first when Tab is pressed on last element', () => {
    const ref = { current: elements.container }
    renderHook(() => useFocusTrap(ref, true))

    // Focus the last focusable button
    elements.thirdButton.focus()
    expect(document.activeElement).toBe(elements.thirdButton)

    // Press Tab on the last element
    const event = dispatchKeyDown(elements.thirdButton, 'Tab')
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(elements.firstButton)
  })

  it('should cycle Shift+Tab from first focusable element back to last', () => {
    const ref = { current: elements.container }
    renderHook(() => useFocusTrap(ref, true))

    // Focus the first focusable button
    elements.firstButton.focus()
    expect(document.activeElement).toBe(elements.firstButton)

    // Press Shift+Tab on the first element
    const event = dispatchKeyDown(elements.firstButton, 'Tab', true)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(elements.thirdButton)
  })

  it('should call onClose when Escape is pressed', () => {
    const ref = { current: elements.container }
    const onClose = vi.fn()

    renderHook(() => useFocusTrap(ref, true, onClose))

    dispatchKeyDown(elements.container, 'Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should not call onClose when Escape is pressed but isActive is false', () => {
    const ref = { current: elements.container }
    const onClose = vi.fn()

    renderHook(() => useFocusTrap(ref, false, onClose))

    dispatchKeyDown(elements.container, 'Escape')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('should restore previously focused element on deactivation', () => {
    const ref = { current: elements.container }
    const outsideButton = document.createElement('button')
    outsideButton.textContent = 'Outside'
    document.body.appendChild(outsideButton)

    // Focus an element outside the container before activation
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    // Activate the trap
    const { rerender } = renderHook(
      ({ active }) => useFocusTrap(ref, active),
      { initialProps: { active: true } },
    )

    // Focus something inside while active
    elements.firstButton.focus()
    expect(document.activeElement).toBe(elements.firstButton)

    // Deactivate — should restore focus to outside button
    rerender({ active: false })
    expect(document.activeElement).toBe(outsideButton)
  })

  it('should handle containers with no focusable elements gracefully', () => {
    const emptyContainer = document.createElement('div')
    emptyContainer.appendChild(document.createTextNode('No focusable elements'))
    document.body.appendChild(emptyContainer)

    const ref = { current: emptyContainer }
    const onClose = vi.fn()

    // Should not throw
    expect(() => {
      renderHook(() => useFocusTrap(ref, true, onClose))
    }).not.toThrow()

    // Escape should still work
    dispatchKeyDown(emptyContainer, 'Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should clean up event listener on deactivation', () => {
    const ref = { current: elements.container }
    const onClose = vi.fn()

    const { rerender } = renderHook(
      ({ active }) => useFocusTrap(ref, active, onClose),
      { initialProps: { active: true } },
    )

    // Deactivate
    rerender({ active: false })

    // Escape should no longer trigger onClose
    dispatchKeyDown(elements.container, 'Escape')
    expect(onClose).not.toHaveBeenCalled()
  })
})
