import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreDisplay } from './ScoreDisplay'

describe('ScoreDisplay', () => {
  it('renders score number', () => {
    render(<ScoreDisplay score={5} player="A" />)
    const scoreElement = screen.getByText('5')
    expect(scoreElement).toBeInTheDocument()
  })

  it('displays zero score', () => {
    render(<ScoreDisplay score={0} player="B" />)
    const scoreElement = screen.getByText('0')
    expect(scoreElement).toBeInTheDocument()
  })

  it('displays large scores', () => {
    render(<ScoreDisplay score={121} player="A" />)
    const scoreElement = screen.getByText('121')
    expect(scoreElement).toBeInTheDocument()
  })

  it('applies animation class', () => {
    const { container } = render(<ScoreDisplay score={10} player="B" />)
    const scoreDiv = container.querySelector('[class*="flex"]')
    expect(scoreDiv).toBeInTheDocument()
  })

  it('shows serving state', () => {
    const { container } = render(
      <ScoreDisplay score={15} player="A" serving={true} />
    )
    expect(container.textContent).toContain('15')
  })

  it('shows winner state', () => {
    const { container } = render(
      <ScoreDisplay score={21} player="B" winner={true} />
    )
    expect(container.textContent).toContain('21')
  })

  it('displays meta information', () => {
    render(
      <ScoreDisplay 
        score={10} 
        player="A"
        meta="Set 1"
      />
    )
    expect(screen.getByText('Set 1')).toBeInTheDocument()
  })
})
