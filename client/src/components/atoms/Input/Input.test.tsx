import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input, PinInput } from './index'

describe('Input', () => {
  it('renders basic input with placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('handles value changes', () => {
    const handleChange = vi.fn()
    render(
      <Input placeholder="Test" value="hello" onChange={handleChange} />
    )
    const input = screen.getByDisplayValue('hello') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'world' } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('shows error state with error message', () => {
    render(<Input placeholder="Test" error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Test')).toHaveClass('ring-red-500/50')
  })

  it('shows hint when provided without error', () => {
    render(<Input placeholder="Test" hint="Enter your name" />)
    expect(screen.getByText('Enter your name')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Input label="Username" placeholder="Enter username" />)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('renders label with correct styling', () => {
    render(<Input label="Email" placeholder="Enter email" />)
    const label = screen.getByText('Email')
    expect(label).toHaveClass('text-sm', 'font-medium')
  })

  it('accepts all HTML input attributes', () => {
    render(
      <Input
        type="email"
        name="email"
        id="email-input"
        placeholder="Enter email"
        required
        autoComplete="email"
        minLength={5}
        maxLength={100}
        pattern="[a-z@.]+"
        readOnly
      />
    )
    const input = screen.getByPlaceholderText('Enter email')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('name', 'email')
    expect(input).toHaveAttribute('id', 'email-input')
    expect(input).toHaveAttribute('required')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).toHaveAttribute('minlength', '5')
    expect(input).toHaveAttribute('maxlength', '100')
    expect(input).toHaveAttribute('pattern', '[a-z@.]+')
    expect(input).toHaveAttribute('readOnly')
  })

  it('accepts custom className', () => {
    render(<Input placeholder="Test" className="mt-4 w-full" />)
    const input = screen.getByPlaceholderText('Test')
    expect(input).toHaveClass('mt-4', 'w-full')
  })

  it('disables input when disabled prop is true', () => {
    render(<Input placeholder="Test" disabled />)
    expect(screen.getByPlaceholderText('Test')).toBeDisabled()
  })

  it('accepts id prop for accessibility', () => {
    render(<Input id="test-input" placeholder="Test" />)
    expect(screen.getByPlaceholderText('Test')).toHaveAttribute('id', 'test-input')
  })

  it('applies type attribute correctly', () => {
    render(<Input type="password" placeholder="Password" />)
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password')
  })

  it('accepts aria-label for accessibility', () => {
    render(<Input aria-label="Search input" placeholder="Search" />)
    expect(screen.getByPlaceholderText('Search')).toHaveAttribute('aria-label', 'Search input')
  })
})

describe('PinInput', () => {
  it('renders correct number of input boxes', () => {
    const { container } = render(<PinInput value="1234" onChange={vi.fn()} length={4} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(4)
  })

  it('renders with custom length', () => {
    const { container } = render(<PinInput value="123456" onChange={vi.fn()} length={6} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(6)
  })

  it('renders with correct values in each box', () => {
    render(<PinInput value="12" onChange={vi.fn()} length={4} />)
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('renders input boxes with correct attributes', () => {
    const { container } = render(<PinInput value="1" onChange={vi.fn()} />)
    const input = container.querySelector('input')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('maxlength', '1')
  })
})