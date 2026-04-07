import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchContext, SetScore } from '../molecules/MatchContext'
import React from 'react'

describe('MatchContext', () => {
  const phases = [
    { phase: 'quarterfinal' as const, text: 'Cuartos de Final' },
    { phase: 'semifinal' as const, text: 'Semifinal' },
    { phase: 'final' as const, text: 'Final' },
  ]

  phases.forEach(({ phase, text }) => {
    it(`renders ${phase} phase`, () => {
      render(<MatchContext phase={phase} status="WAITING" />)
      expect(screen.getByText(text)).toBeInTheDocument()
    })
  })

  it('shows live badge when status is LIVE', () => {
    render(<MatchContext phase="quarterfinal" status="LIVE" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows match number when provided', () => {
    render(<MatchContext phase="quarterfinal" status="WAITING" matchNumber={1} totalMatches={4} />)
    expect(screen.getByText('Partido 1 de 4')).toBeInTheDocument()
  })

  it('shows config when provided', () => {
    render(<MatchContext phase="quarterfinal" status="WAITING" bestOf={3} pointsPerSet={21} />)
    expect(screen.getByText('3 a 3')).toBeInTheDocument()
    expect(screen.getByText('21 pts/set')).toBeInTheDocument()
  })
})

describe('SetScore', () => {
  it('renders set number', () => {
    render(<SetScore setNumber={1} scoreA={5} scoreB={3} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('renders scores', () => {
    render(<SetScore setNumber={1} scoreA={5} scoreB={3} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('highlights current set', () => {
    render(<SetScore setNumber={1} scoreA={5} scoreB={3} isCurrentSet />)
    expect(document.querySelector('.ring-1')).toBeInTheDocument()
  })
})