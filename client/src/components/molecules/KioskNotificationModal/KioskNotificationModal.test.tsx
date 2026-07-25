import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KioskNotificationModal } from './KioskNotificationModal'

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
}

describe('KioskNotificationModal', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders when isOpen is true', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    expect(screen.getByText('notificationModalTitle')).toBeInTheDocument()
    expect(screen.getByText('commonCancel')).toBeInTheDocument()
    expect(screen.getByText('notificationSend')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<KioskNotificationModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('notificationModalTitle')).not.toBeInTheDocument()
  })

  // ── Type selector ──────────────────────────────────────────────────

  it('renders all 4 notification type buttons', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    expect(screen.getByText('notificationTypeInfo')).toBeInTheDocument()
    expect(screen.getByText('notificationTypeWarning')).toBeInTheDocument()
    expect(screen.getByText('notificationTypeError')).toBeInTheDocument()
    expect(screen.getByText('notificationTypeImportant')).toBeInTheDocument()
  })

  it('highlighting type selection changes visual state', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const warningBtn = screen.getByText('notificationTypeWarning').closest('button')!
    // Before selection — type has default border style
    expect(warningBtn.className).toContain('border-border')
    // Click warning type to select it
    fireEvent.click(warningBtn)
    // After selection — border changes to primary style
    expect(warningBtn.className).toContain('border-primary')
    expect(warningBtn.className).toContain('bg-primary/10')
  })

  // ── Char counter ───────────────────────────────────────────────────

  it('shows initial char counter as 0/280', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    // Counter renders in a Body component as a single text node "0/280"
    expect(screen.getByText(/^0\/280$/)).toBeInTheDocument()
  })

  it('updates char counter as user types in textarea', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello kiosk!' } })
    // "Hello kiosk!" is 12 characters
    expect(screen.getByText(/^12\/280$/)).toBeInTheDocument()
  })

  it('updates char counter when near the limit', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    const longMsg = 'A'.repeat(280)
    fireEvent.change(textarea, { target: { value: longMsg } })
    expect(screen.getByText(/^280\/280$/)).toBeInTheDocument()
  })

  // ── Duration dropdown ──────────────────────────────────────────────

  it('shows duration selector with selected value', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    // Default should be 5s
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect((select as HTMLSelectElement).value).toBe('5')
  })

  it('has 4 duration options: 5, 10, 15, 30', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const select = screen.getByRole('combobox')
    const options = Array.from((select as HTMLSelectElement).options).map(o => o.value)
    expect(options).toEqual(['5', '10', '15', '30'])
  })

  it('defaults duration to 5s', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const select = screen.getByRole('combobox')
    expect((select as HTMLSelectElement).value).toBe('5')
  })

  // ── Validation → empty message blocked ─────────────────────────────

  it('disables submit button when message is empty', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const submitBtn = screen.getByText('notificationSend')
    expect(submitBtn).toBeDisabled()
  })

  it('enables submit when a type is selected and message is filled', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    // Select a type
    fireEvent.click(screen.getByText('notificationTypeInfo'))
    // Type a message
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Match starting soon' } })
    // Submit should be enabled now
    const submitBtn = screen.getByText('notificationSend')
    expect(submitBtn).not.toBeDisabled()
  })

  it('disables submit when message is only whitespace', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('notificationTypeInfo'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    const submitBtn = screen.getByText('notificationSend')
    expect(submitBtn).toBeDisabled()
  })

  it('disables submit when no type is selected but message is filled', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'No type selected' } })
    const submitBtn = screen.getByText('notificationSend')
    // Should still be disabled because type is required
    expect(submitBtn).toBeDisabled()
  })

  // ── Submission ─────────────────────────────────────────────────────

  it('submits with correct payload: type, message, duration, and default scope', () => {
    const onSubmit = vi.fn()
    render(<KioskNotificationModal {...defaultProps} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText('notificationTypeError'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'System maintenance' } })
    fireEvent.click(screen.getByText('notificationSend'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      type: 'error',
      message: 'System maintenance',
      duration: 5,
      scope: 'club',
    })
  })

  it('submits with custom duration when changed', () => {
    const onSubmit = vi.fn()
    render(<KioskNotificationModal {...defaultProps} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText('notificationTypeImportant'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Important announcement' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '30' } })
    fireEvent.click(screen.getByText('notificationSend'))

    expect(onSubmit).toHaveBeenCalledWith({
      type: 'important',
      message: 'Important announcement',
      duration: 30,
      scope: 'club',
    })
  })

  it('disables submit and all inputs when isLoading', () => {
    render(<KioskNotificationModal {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByText('notificationSend')).toBeDisabled()
  })

  // ── Modal dismissal ────────────────────────────────────────────────

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<KioskNotificationModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('commonCancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<KioskNotificationModal {...defaultProps} onClose={onClose} />)
    const backdrop = document.querySelector('.bg-black\\/50')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<KioskNotificationModal {...defaultProps} onClose={onClose} />)
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    if (overlay) {
      fireEvent.keyDown(overlay, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  // ── Error display ──────────────────────────────────────────────────

  it('shows error text when error prop is provided', () => {
    render(<KioskNotificationModal {...defaultProps} error="Connection lost" />)
    expect(screen.getByText('Connection lost')).toBeInTheDocument()
  })

  // ── Message truncation ─────────────────────────────────────────────

  it('textarea does not accept more than 280 characters', () => {
    render(<KioskNotificationModal {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('maxLength', '280')
  })

  // ── Task 3.3: showGeneralToggle + generalLabel props ───────────────

  describe('scope toggle (task 3.3)', () => {
    it('does NOT render scope toggle by default', () => {
      render(<KioskNotificationModal {...defaultProps} />)
      expect(screen.queryByText('notificationScopeLabel')).not.toBeInTheDocument()
    })

    it('renders scope toggle checkbox when showGeneralToggle is true', () => {
      render(
        <KioskNotificationModal
          {...defaultProps}
          showGeneralToggle={true}
          generalLabel="notificationScopeGeneral"
        />,
      )
      expect(screen.getByText('notificationScopeGeneral')).toBeInTheDocument()
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it('renders scope toggle with custom label', () => {
      render(
        <KioskNotificationModal
          {...defaultProps}
          showGeneralToggle={true}
          generalLabel="Broadcast to all"
        />,
      )
      expect(screen.getByText('Broadcast to all')).toBeInTheDocument()
    })

    it('checkbox can be toggled on and off', () => {
      render(
        <KioskNotificationModal
          {...defaultProps}
          showGeneralToggle={true}
          generalLabel="General"
        />,
      )
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()

      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()

      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('passes scope as "general" in submit payload when checkbox is checked, "club" when unchecked', () => {
      const onSubmit = vi.fn()
      render(
        <KioskNotificationModal
          {...defaultProps}
          onSubmit={onSubmit}
          showGeneralToggle={true}
          generalLabel="General"
        />,
      )

      // Fill required fields
      fireEvent.click(screen.getByText('notificationTypeInfo'))
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Scope test' } })

      // Check the toggle
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByText('notificationSend'))

      expect(onSubmit).toHaveBeenCalledWith({
        type: 'info',
        message: 'Scope test',
        duration: 5,
        scope: 'general',
      })

      onSubmit.mockClear()

      // Uncheck and submit again
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByText('notificationSend'))

      expect(onSubmit).toHaveBeenCalledWith({
        type: 'info',
        message: 'Scope test',
        duration: 5,
        scope: 'club',
      })
    })
  })

  // ── Task 3.4: Per-type contextual placeholder ──────────────────────

  describe('per-type contextual placeholder (task 3.4)', () => {
    const placeholderProps = {
      messagePlaceholders: {
        info: 'Notification info',
        warning: 'Notification warning',
        error: 'Notification error',
        important: 'Notification important',
      } as Record<string, string>,
    }

    it.each([
      ['info', 'Notification info'],
      ['warning', 'Notification warning'],
      ['error', 'Notification error'],
      ['important', 'Notification important'],
    ])('shows %s context placeholder when %s type is selected', (type, expectedPlaceholder) => {
      render(<KioskNotificationModal {...defaultProps} {...placeholderProps} />)
      const textarea = screen.getByRole('textbox')

      // Initially has the default placeholder
      expect(textarea).toHaveAttribute('placeholder', 'notificationMessagePlaceholder')

      // Select a type
      const typeLabel = type === 'info' ? 'notificationTypeInfo'
        : type === 'warning' ? 'notificationTypeWarning'
        : type === 'error' ? 'notificationTypeError'
        : 'notificationTypeImportant'
      fireEvent.click(screen.getByText(typeLabel))

      // Placeholder should update to contextual version
      expect(textarea).toHaveAttribute('placeholder', expectedPlaceholder)
    })

    it('resets placeholder to default when type selection is cleared', () => {
      render(<KioskNotificationModal {...defaultProps} {...placeholderProps} />)
      const textarea = screen.getByRole('textbox')

      fireEvent.click(screen.getByText('notificationTypeInfo'))
      expect(textarea).toHaveAttribute('placeholder', 'Notification info')

      // Click same type again to deselect
      fireEvent.click(screen.getByText('notificationTypeInfo'))
      // When deselected, should go back to default
      expect(textarea).toHaveAttribute('placeholder', 'notificationMessagePlaceholder')
    })
  })

  // ── Task 3.5: Visual ring on selected type button ──────────────────

  describe('selected type highlight ring (task 3.5)', () => {
    /** Check for the visual ring-2 class (not the focus:ring-2 present on all buttons) */
    function hasRing(el: HTMLElement): boolean {
      return el.className.split(' ').includes('ring-2')
    }

    it('adds visual ring highlight to the selected type button', () => {
      render(<KioskNotificationModal {...defaultProps} />)
      const infoBtn = screen.getByText('notificationTypeInfo').closest('button')!

      // Before selection — no ring
      expect(hasRing(infoBtn)).toBe(false)

      fireEvent.click(infoBtn)

      // After selection — should have visual ring classes
      expect(hasRing(infoBtn)).toBe(true)
    })

    it('removes ring from previously selected type when a new type is selected', () => {
      render(<KioskNotificationModal {...defaultProps} />)
      const infoBtn = screen.getByText('notificationTypeInfo').closest('button')!
      const warningBtn = screen.getByText('notificationTypeWarning').closest('button')!

      fireEvent.click(infoBtn)
      expect(hasRing(infoBtn)).toBe(true)

      fireEvent.click(warningBtn)
      expect(hasRing(warningBtn)).toBe(true)
      // Info should no longer have the ring
      expect(hasRing(infoBtn)).toBe(false)
    })
  })
})
