import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from './Input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
  })

  it('handles value changes', () => {
    const handleChange = vi.fn()
    render(
      <Input
        placeholder="Test"
        value="hello"
        onChange={handleChange}
      />
    )
    const input = screen.getByDisplayValue('hello') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'world' } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders label when provided', () => {
    render(
      <Input
        label="Username"
        placeholder="Enter username"
      />
    )
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(
      <Input
        placeholder="Test"
        error="This field is required"
      />
    )
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('disables input when disabled prop is true', () => {
    render(
      <Input
        placeholder="Test"
        disabled
      />
    )
    const input = screen.getByPlaceholderText('Test')
    expect(input).toBeDisabled()
  })

  it('sets maxLength attribute', () => {
    render(
      <Input
        placeholder="Test"
        maxLength={5}
      />
    )
    const input = screen.getByPlaceholderText('Test')
    expect(input).toHaveAttribute('maxlength', '5')
  })
})
