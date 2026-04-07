import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Typography } from './Typography'

describe('Typography', () => {
  it('renders Headline with correct variant', () => {
    render(<Typography variant="headline">Test Headline</Typography>)
    const elem = screen.getByText('Test Headline')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('font-heading')
  })

  it('renders Title with correct styles', () => {
    render(<Typography variant="title">Test Title</Typography>)
    const elem = screen.getByText('Test Title')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[28px]')
  })

  it('renders Body variant', () => {
    render(<Typography variant="body">Test Body</Typography>)
    const elem = screen.getByText('Test Body')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[18px]')
  })

  it('renders Label variant', () => {
    render(<Typography variant="label">Test Label</Typography>)
    const elem = screen.getByText('Test Label')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[14px]')
  })

  it('renders Caption variant', () => {
    render(<Typography variant="caption">Test Caption</Typography>)
    const elem = screen.getByText('Test Caption')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[12px]')
  })

  it('accepts className prop', () => {
    render(
      <Typography variant="body" className="custom-class">
        Test
      </Typography>
    )
    const elem = screen.getByText('Test')
    expect(elem).toHaveClass('custom-class')
  })
})
