import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, ScoreButton } from '../atoms/Button'
import React from 'react'

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant with gradient', () => {
      render(<Button variant="primary">Primary</Button>)
      const btn = screen.getByRole('button', { name: 'Primary' })
      expect(btn).toBeInTheDocument()
      expect(btn).toHaveClass('bg-gradient-primary')
    })

    it('renders secondary variant with tonal bg', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const btn = screen.getByRole('button', { name: 'Secondary' })
      expect(btn).toHaveClass('bg-surface-low')
    })

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const btn = screen.getByRole('button', { name: 'Ghost' })
      expect(btn).toHaveClass('bg-transparent')
    })

    it('renders live variant with amber gradient', () => {
      render(<Button variant="live">Live</Button>)
      const btn = screen.getByRole('button', { name: 'Live' })
      expect(btn).toHaveClass('bg-gradient-live')
    })
  })

  describe('sizes', () => {
    it('renders sm size', () => {
      render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-3')
    })

    it('renders md size', () => {
      render(<Button size="md">Medium</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-4')
    })

    it('renders lg size', () => {
      render(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-6')
    })
  })

  describe('states', () => {
    it('calls onClick handler when clicked', () => {
      const handler = vi.fn()
      render(<Button onClick={handler}>Click me</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not call handler when disabled', () => {
      const handler = vi.fn()
      render(<Button disabled>Disabled</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('shows loading spinner when loading', () => {
      render(<Button loading>Loading</Button>)
      // Loading shows a spinner element
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })
})

describe('ScoreButton', () => {
  it('renders player side A', () => {
    render(<ScoreButton side="A" onClick={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders player side B', () => {
    render(<ScoreButton side="B" onClick={() => {}} />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handler = vi.fn()
    render(<ScoreButton side="A" onClick={handler} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not call handler when disabled', () => {
    const handler = vi.fn()
    render(<ScoreButton side="A" onClick={handler} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).not.toHaveBeenCalled()
  })
})