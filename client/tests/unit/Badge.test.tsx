import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge } from '../atoms/Badge'
import React from 'react'

describe('Badge', () => {
  describe('status variants', () => {
    it('renders waiting status', () => {
      render(<Badge status="waiting">Waiting</Badge>)
      expect(screen.getByText('Waiting')).toBeInTheDocument()
    })

    it('renders configuring status', () => {
      render(<Badge status="configuring">Configuring</Badge>)
      expect(screen.getByText('Configuring')).toBeInTheDocument()
    })

    it('renders live status', () => {
      render(<Badge status="live">Live</Badge>)
      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('renders finished status', () => {
      render(<Badge status="finished">Finished</Badge>)
      expect(screen.getByText('Finished')).toBeInTheDocument()
    })

    it('renders default status', () => {
      render(<Badge>Default</Badge>)
      expect(screen.getByText('Default')).toBeInTheDocument()
    })
  })
})

describe('Convenience Components', () => {
  it('WaitingBadge renders waiting text', () => {
    render(<WaitingBadge />)
    expect(screen.getByText('Waiting')).toBeInTheDocument()
  })

  it('ConfiguringBadge renders configuring text', () => {
    render(<ConfiguringBadge />)
    expect(screen.getByText('Configuring')).toBeInTheDocument()
  })

  it('LiveBadge renders live text', () => {
    render(<LiveBadge />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('FinishedBadge renders finished text', () => {
    render(<FinishedBadge />)
    expect(screen.getByText('Finished')).toBeInTheDocument()
  })
})