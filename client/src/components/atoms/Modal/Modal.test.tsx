import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal atom', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Title">
        <p>body</p>
      </Modal>,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="My Modal Title">
        <p>modal body content</p>
      </Modal>,
    )
    expect(screen.getByText('My Modal Title')).toBeInTheDocument()
    expect(screen.getByText('modal body content')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>,
    )
    // The role="dialog" is the inner card; the backdrop is the outer overlay.
    // Click the overlay (the first outer container) — point outside the dialog.
    const overlay = screen.getByRole('dialog').parentElement!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when clicking the dialog content', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>,
    )
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not listen to Escape when closed', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={false} onClose={onClose} title="T">
        <p>body</p>
      </Modal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders an X close button that calls onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>,
    )
    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cleans up Escape listener on unmount', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <Modal isOpen onClose={onClose} title="T">
        <p>body</p>
      </Modal>,
    )
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders centered with card-light + max-w-md on desktop (default)', () => {
    render(
      <Modal isOpen onClose={() => {}} title="T">
        <p>body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('card-light')
    expect(dialog.className).toContain('max-w-md')
  })

  it('applies fullscreen class when fullscreen prop is true', () => {
    render(
      <Modal isOpen onClose={() => {}} title="T" fullscreen>
        <p>body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    // Fullscreen modal fills the viewport at mobile widths but is still
    // constrained on desktop via the responsive md: prefix (NOT a bare
    // max-w-md, which would shrink the mobile modal).
    expect(dialog.className).not.toContain(' max-w-md')
    expect(dialog.className).toContain('md:max-w-md')
  })

  it('has aria-modal and role=dialog on the dialog element', () => {
    render(
      <Modal isOpen onClose={() => {}} title="T">
        <p>body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})