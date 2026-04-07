import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardGrid, DashboardHeader } from '../organisms/DashboardGrid'
import React from 'react'
import type { TableInfo } from '../../../../shared/types'

const mockTables: TableInfo[] = [
  { id: '1', number: 1, name: 'Mesa 1', status: 'WAITING', pin: '0000', playerCount: 0 },
  { id: '2', number: 2, name: 'Mesa 2', status: 'LIVE', pin: '0000', playerCount: 2, playerNames: { a: 'A', b: 'B' } },
  { id: '3', number: 3, name: 'Mesa 3', status: 'FINISHED', pin: '0000', playerCount: 2 },
]

describe('DashboardGrid', () => {
  it('renders table list', () => {
    render(<DashboardGrid tables={mockTables} />)
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Mesa 2')).toBeInTheDocument()
    expect(screen.getByText('Mesa 3')).toBeInTheDocument()
  })

  it('renders in list mode', () => {
    render(<DashboardGrid tables={mockTables} viewMode="list" />)
    // List mode just changes layout
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<DashboardGrid tables={[]} />)
    expect(screen.queryByText('Mesa')).not.toBeInTheDocument()
  })
})

describe('DashboardHeader', () => {
  it('renders title', () => {
    render(<DashboardHeader totalTables={5} liveMatches={2} activePlayers={4} viewMode="grid" onViewModeChange={() => {}} />)
    expect(screen.getByText('The Kinetic Clubhouse')).toBeInTheDocument()
  })

  it('displays stats', () => {
    render(<DashboardHeader totalTables={5} liveMatches={2} activePlayers={4} viewMode="grid" onViewModeChange={() => {}} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('calls onViewModeChange when toggling', () => {
    const handler = vi.fn()
    render(<DashboardHeader totalTables={5} liveMatches={2} activePlayers={4} viewMode="grid" onViewModeChange={handler} />)
    
    // Get grid button and click
    const gridBtn = document.querySelector('button[aria-label="Grid view"]')
    gridBtn?.click()
    
    expect(handler).toHaveBeenCalledWith('grid')
  })
})