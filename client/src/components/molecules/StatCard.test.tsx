import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard, MiniStatCard } from '../molecules/StatCard'
import React from 'react'

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total" value={42} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows trend up with arrow', () => {
    render(<StatCard title="Score" value={100} trend="up" change={15} />)
    expect(screen.getByText('↑')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('shows trend down', () => {
    render(<StatCard title="Score" value={50} trend="down" change={10} />)
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('shows neutral trend', () => {
    render(<StatCard title="Score" value={75} trend="neutral" change={0} />)
    expect(screen.getByText('→')).toBeInTheDocument()
  })
})

describe('MiniStatCard', () => {
  it('renders label and value', () => {
    render(<MiniStatCard label="Label" value="Value" />)
    expect(screen.getByText('Label')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
  })
})