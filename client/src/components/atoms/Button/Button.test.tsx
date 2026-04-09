import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './index'

describe('Button', () => {
  it('renders button with text', () => {
    const { container } = render(<Button animate={false}>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Click me')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    const { container } = render(<Button onClick={handleClick} animate={false}>Click me</Button>)
    const button = container.querySelector('button')!
    button.click()
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('default variant is primary', () => {
    const { container } = render(<Button animate={false}>Primary</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('bg-gradient-primary')
  })

  it('applies secondary variant styles', () => {
    const { container } = render(<Button variant="secondary" animate={false}>Secondary</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('bg-surface-low')
  })

  it('applies danger variant styles', () => {
    const { container } = render(<Button variant="danger" animate={false}>Danger</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('bg-red-500')
  })

  it('applies outline variant styles', () => {
    const { container } = render(<Button variant="outline" animate={false}>Outline</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('border-2', 'border-primary')
  })

  it('disables button when disabled prop is true', () => {
    const { container } = render(<Button disabled animate={false}>Disabled</Button>)
    const button = container.querySelector('button')!
    expect(button).toBeDisabled()
  })

  it('prevents click when disabled', () => {
    const handleClick = vi.fn()
    const { container } = render(<Button disabled onClick={handleClick} animate={false}>Disabled</Button>)
    const button = container.querySelector('button')!
    button.click()
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows spinner when loading is true', () => {
    const { container } = render(<Button loading animate={false}>Loading</Button>)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('button is disabled when loading', () => {
    const { container } = render(<Button loading animate={false}>Loading</Button>)
    const button = container.querySelector('button')!
    expect(button).toBeDisabled()
  })

  it('renders with animation when animate=true (mocked)', () => {
    const { container } = render(<Button animate={true}>Animated</Button>)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders xs size correctly', () => {
    const { container } = render(<Button size="xs" animate={false}>XS</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('px-2', 'py-1', 'text-xs')
  })

  it('renders sm size correctly', () => {
    const { container } = render(<Button size="sm" animate={false}>SM</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm')
  })

  it('renders md size correctly', () => {
    const { container } = render(<Button size="md" animate={false}>MD</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('px-4', 'py-2', 'text-base')
  })

  it('renders lg size correctly', () => {
    const { container } = render(<Button size="lg" animate={false}>LG</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg')
  })

  it('renders xl size correctly', () => {
    const { container } = render(<Button size="xl" animate={false}>XL</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('px-8', 'py-4', 'text-2xl')
  })

  it('renders icon when provided', () => {
    const icon = <span data-testid="icon">★</span>
    render(<Button icon={icon} animate={false}>With Icon</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class" animate={false}>Custom</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('custom-class')
  })

  it('applies fullWidth class when fullWidth=true', () => {
    const { container } = render(<Button fullWidth animate={false}>Full Width</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('w-full')
  })

  it('has focus ring styles', () => {
    const { container } = render(<Button animate={false}>Focus</Button>)
    const button = container.querySelector('button')!
    expect(button).toHaveClass('focus:ring-2', 'focus:ring-primary/30')
  })
})