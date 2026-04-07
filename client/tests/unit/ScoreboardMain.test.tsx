import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreboardMain, MatchConfigPanel } from '../organisms/ScoreboardMain'
import React from 'react'
import type { MatchStateExtended, Score } from '../../../../shared/types'

const mockMatchState: MatchStateExtended = {
  tableId: '1',
  tableName: 'Mesa 1',
  config: { pointsPerSet: 21, bestOf: 3, minDifference: 2 },
  score: {
    sets: [],
    currentSet: { a: 5, b: 3 },
    serving: 'A',
  },
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
  playerNames: { a: 'Juan', b: 'Pedro' },
  history: [],
  undoAvailable: true,
}

describe('ScoreboardMain', () => {
  it('renders match scores', () => {
    render(<ScoreboardMain match={mockMatchState} onScorePoint={() => {}} />)
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText('Pedro')).toBeInTheDocument()
  })

  it('shows referee controls when isReferee', () => {
    render(<ScoreboardMain match={mockMatchState} onScorePoint={() => {}} isReferee />)
    expect(screen.getByText('Deshacer')).toBeInTheDocument()
  })

  it('hides referee controls when not referee', () => {
    render(<ScoreboardMain match={mockMatchState} onScorePoint={() => {}} isReferee={false} />)
    expect(screen.queryByText('Deshacer')).not.toBeInTheDocument()
  })

  it('calls onScorePoint when score button clicked', () => {
    const handler = vi.fn()
    render(<ScoreboardMain match={mockMatchState} onScorePoint={handler} isReferee />)
    
    const buttons = document.querySelectorAll('button')
    // Find button with "A" text and click
    const buttonA = Array.from(buttons).find(b => b.textContent === 'A')
    buttonA?.click()
    
    expect(handler).toHaveBeenCalledWith('A')
  })
})

describe('MatchConfigPanel', () => {
  it('renders config options', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Configurar Partido')).toBeInTheDocument()
    expect(screen.getByText('Puntos por set')).toBeInTheDocument()
    expect(screen.getByText('Mejor de')).toBeInTheDocument()
  })

  it('renders point options', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
  })

  it('renders best of options', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('calls onStart with config', () => {
    const handler = vi.fn()
    render(<MatchConfigPanel onStart={handler} onCancel={() => {}} />)
    
    // Click on 11 points option
    const pointBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === '11')
    pointBtn?.click()
    
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ pointsPerSet: 11 }))
  })
})