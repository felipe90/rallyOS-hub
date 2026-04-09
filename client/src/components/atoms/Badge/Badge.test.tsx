import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge } from './index'
import React from 'react'

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children text correctly', () => {
      render(<Badge>Test Badge</Badge>)
      expect(screen.getByText('Test Badge')).toBeInTheDocument()
    })

    it('renders as a span element', () => {
      const { container } = render(<Badge>Test</Badge>)
      expect(container.firstChild?.nodeName).toBe('SPAN')
    })
  })

  describe('status variants', () => {
    it('renders waiting status with correct styles', () => {
      render(<Badge status="waiting">Waiting</Badge>)
      const badge = screen.getByText('Waiting')
      expect(badge).toHaveClass('bg-surface-low')
      expect(badge).toHaveClass('text-text')
    })

    it('renders configuring status with correct styles', () => {
      render(<Badge status="configuring">Configuring</Badge>)
      const badge = screen.getByText('Configuring')
      expect(badge).toHaveClass('bg-tertiary/10')
      expect(badge).toHaveClass('text-tertiary-dark')
    })

    it('renders live status with correct styles', () => {
      render(<Badge status="live">Live</Badge>)
      const badge = screen.getByText('Live')
      expect(badge).toHaveClass('bg-amber/20')
      expect(badge).toHaveClass('text-amber-light')
    })

    it('renders finished status with correct styles', () => {
      render(<Badge status="finished">Finished</Badge>)
      const badge = screen.getByText('Finished')
      expect(badge).toHaveClass('bg-primary/10')
      expect(badge).toHaveClass('text-primary-dark')
    })

    it('renders default status when no status provided', () => {
      render(<Badge>Default</Badge>)
      const badge = screen.getByText('Default')
      expect(badge).toHaveClass('bg-surface')
      expect(badge).toHaveClass('text-text')
    })
  })

  describe('dot prop', () => {
    it('renders dot when dot prop is true', () => {
      const { container } = render(<Badge status="waiting" dot>With Dot</Badge>)
      const dot = container.querySelector('span.w-2')
      expect(dot).toBeInTheDocument()
      expect(dot).toHaveClass('h-2', 'rounded-full')
    })

    it('does not render dot when dot prop is false', () => {
      const { container } = render(<Badge status="waiting" dot={false}>No Dot</Badge>)
      const dot = container.querySelector('.w-2')
      expect(dot).not.toBeInTheDocument()
    })

    it('renders dot with correct color for waiting status', () => {
      const { container } = render(<Badge status="waiting" dot>Waiting</Badge>)
      const dot = container.querySelector('span.w-2')
      expect(dot).toHaveClass('bg-border')
    })

    it('renders dot with pulse animation for live status', () => {
      const { container } = render(<Badge status="live" dot>Live</Badge>)
      const dot = container.querySelector('span.w-2')
      expect(dot).toHaveClass('animate-pulse')
    })
  })

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<Badge className="custom-class">Custom</Badge>)
      const badge = screen.getByText('Custom')
      expect(badge).toHaveClass('custom-class')
    })
  })

  describe('accessibility', () => {
    it('has accessible inline-flex layout', () => {
      render(<Badge>Accessible</Badge>)
      const badge = screen.getByText('Accessible')
      expect(badge).toHaveClass('inline-flex', 'items-center', 'gap-2')
    })
  })
})

describe('Convenience Components', () => {
  it('WaitingBadge renders with waiting status and dot', () => {
    const { container } = render(<WaitingBadge />)
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(container.querySelector('.w-2')).toBeInTheDocument()
  })

  it('ConfiguringBadge renders with configuring status and dot', () => {
    const { container } = render(<ConfiguringBadge />)
    expect(screen.getByText('Configuring')).toBeInTheDocument()
    expect(container.querySelector('.w-2')).toBeInTheDocument()
  })

  it('LiveBadge renders with live status and dot', () => {
    const { container } = render(<LiveBadge />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(container.querySelector('.w-2')).toBeInTheDocument()
  })

  it('FinishedBadge renders with finished status and dot', () => {
    const { container } = render(<FinishedBadge />)
    expect(screen.getByText('Finished')).toBeInTheDocument()
    expect(container.querySelector('.w-2')).toBeInTheDocument()
  })

  it('convenience components accept className prop', () => {
    render(<LiveBadge className="test-class" />)
    const badge = screen.getByText('Live')
    expect(badge).toHaveClass('test-class')
  })
})