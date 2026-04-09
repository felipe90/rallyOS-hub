import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Typography, Headline, Title, Body, Label, Caption } from './index'

describe('Typography', () => {
  it('renders headline variant', () => {
    render(<Typography variant="headline">Test Headline</Typography>)
    const elem = screen.getByText('Test Headline')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('font-heading', 'text-[56px]')
  })

  it('renders title variant', () => {
    render(<Typography variant="title">Test Title</Typography>)
    const elem = screen.getByText('Test Title')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[28px]')
  })

  it('renders body variant', () => {
    render(<Typography variant="body">Test Body</Typography>)
    const elem = screen.getByText('Test Body')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[18px]', 'font-body')
  })

  it('renders label variant', () => {
    render(<Typography variant="label">Test Label</Typography>)
    const elem = screen.getByText('Test Label')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[14px]', 'tracking-widest')
  })

  it('renders caption variant', () => {
    render(<Typography variant="caption">Test Caption</Typography>)
    const elem = screen.getByText('Test Caption')
    expect(elem).toBeInTheDocument()
    expect(elem).toHaveClass('text-[12px]')
  })

  it('renders children correctly', () => {
    render(<Typography variant="body">Hello World</Typography>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('merges custom className with variant styles', () => {
    render(
      <Typography variant="body" className="custom-class">
        Test
      </Typography>
    )
    const elem = screen.getByText('Test')
    expect(elem).toHaveClass('custom-class')
    expect(elem).toHaveClass('text-[18px]')
  })

  it('applies weight prop correctly', () => {
    render(<Typography variant="body" weight={700}>Bold Text</Typography>)
    const elem = screen.getByText('Bold Text')
    expect(elem).toHaveClass('font-bold')
  })

  it('renders as custom element with as prop', () => {
    render(<Typography variant="title" as="h1">Custom Element</Typography>)
    const elem = screen.getByText('Custom Element')
    expect(elem.tagName).toBe('H1')
  })

  describe('Subcomponents', () => {
    it('renders Headline subcomponent', () => {
      render(<Headline>Headline Text</Headline>)
      expect(screen.getByText('Headline Text')).toBeInTheDocument()
    })

    it('renders Title subcomponent', () => {
      render(<Title>Title Text</Title>)
      expect(screen.getByText('Title Text')).toBeInTheDocument()
    })

    it('renders Body subcomponent', () => {
      render(<Body>Body Text</Body>)
      expect(screen.getByText('Body Text')).toBeInTheDocument()
    })

    it('renders Label subcomponent', () => {
      render(<Label>Label Text</Label>)
      expect(screen.getByText('Label Text')).toBeInTheDocument()
    })

    it('renders Caption subcomponent', () => {
      render(<Caption>Caption Text</Caption>)
      expect(screen.getByText('Caption Text')).toBeInTheDocument()
    })
  })
})