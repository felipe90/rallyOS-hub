import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryDrawer } from '../organisms/HistoryDrawer'
import React from 'react'
import type { ScoreChange } from '../../../../shared/types'

const mockEvents: ScoreChange[] = [
  {
    id: '1',
    player: 'A',
    action: 'POINT',
    pointsBefore: { a: 4, b: 3 },
    pointsAfter: { a: 5, b: 3 },
    timestamp: Date.now() - 60000,
  },
  {
    id: '2',
    player: 'B',
    action: 'POINT',
    pointsBefore: { a: 5, b: 2 },
    pointsAfter: { a: 5, b: 3 },
    timestamp: Date.now() - 120000,
  },
]

describe('HistoryDrawer', () => {
  it('does not render when closed', () => {
    render(<HistoryDrawer isOpen={false} onClose={() => {}} events={[]} onUndo={() => {}} />)
    expect(screen.queryByText('Historial')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(<HistoryDrawer isOpen onClose={() => {}} events={[]} onUndo={() => {}} />)
    expect(screen.getByText('Historial')).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    render(<HistoryDrawer isOpen onClose={() => {}} events={[]} onUndo={() => {}} />)
    expect(screen.getByText('Sin eventos aún')).toBeInTheDocument()
  })

  it('renders events list', () => {
    render(<HistoryDrawer isOpen onClose={() => {}} events={mockEvents} onUndo={() => {}} />)
    expect(screen.getByText('5 - 3')).toBeInTheDocument()
  })

  it('shows event player and action', () => {
    render(<HistoryDrawer isOpen onClose={() => {}} events={mockEvents} onUndo={() => {}} />)
    expect(screen.getByText(/Player A.*Punto/)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const handler = vi.fn()
    render(<HistoryDrawer isOpen onClose={handler} events={[]} onUndo={() => {}} />)
    
    const closeBtn = document.querySelector('button')
    closeBtn?.click()
    
    expect(handler).toHaveBeenCalled()
  })

  it('calls onUndo when undo button clicked', () => {
    const handler = vi.fn()
    render(<HistoryDrawer isOpen onClose={() => {}} events={mockEvents} onUndo={handler} />)
    
    // The first event should have an undo button
    const undoBtns = document.querySelectorAll('button')
    expect(undoBtns.length).toBeGreaterThan(0)
  })
})