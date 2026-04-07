import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreDisplay, ScorePair } from '../molecules/ScoreDisplay'
import React from 'react'
import type { Score } from '../../../../shared/types'

describe('ScoreDisplay', () => {
  describe('rendering', () => {
    it('renders score number', () => {
      render(<ScoreDisplay score={5} player="A" />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders player label', () => {
      render(<ScoreDisplay score={0} player="B" />)
      expect(screen.getByText('Player B')).toBeInTheDocument()
    })

    it('renders meta text when provided', () => {
      render(<ScoreDisplay score={10} player="A" meta="Player Name" />)
      expect(screen.getByText('Player Name')).toBeInTheDocument()
    })
  })

  describe('states', () => {
    it('shows serving indicator when serving', () => {
      render(<ScoreDisplay score={5} player="A" serving />)
      const indicator = document.querySelector('.animate-pulse')
      expect(indicator).toBeInTheDocument()
    })

    it('shows ring when winner', () => {
      render(<ScoreDisplay score={21} player="A" winner />)
      expect(screen.getByText('21').closest('div')).toHaveClass('ring-2')
    })
  })
})

describe('ScorePair', () => {
  const mockScore: Score = { a: 5, b: 3 }

  it('renders both scores', () => {
    render(<ScorePair score={mockScore} serving="A" playerNames={{ a: 'Juan', b: 'Pedro' }} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows player names', () => {
    render(<ScorePair score={mockScore} serving="A" playerNames={{ a: 'Juan', b: 'Pedro' }} />)
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText('Pedro')).toBeInTheDocument()
  })

  it('shows serving player indicator', () => {
    render(<ScorePair score={mockScore} serving="A" playerNames={{ a: 'Juan', b: 'Pedro' }} />)
    const indicators = document.querySelectorAll('.animate-pulse')
    expect(indicators).toHaveLength(1)
  })
})