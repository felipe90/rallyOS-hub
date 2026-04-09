import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PinInput } from './index'

describe('PinInput', () => {
  it('renders input element', () => {
    const { container } = render(<PinInput />)
    const input = container.querySelector('input')
    expect(input).toBeInTheDocument()
  })

  it('filters non-numeric input', () => {
    const handleChange = vi.fn()
    const { container } = render(<PinInput onChange={handleChange} />)
    const input = container.querySelector('input')!
    
    fireEvent.change(input, { target: { value: 'abc123def' } })
    
    expect(handleChange).toHaveBeenCalledWith('123')
  })

  it('limits input to specified length', () => {
    const handleChange = vi.fn()
    const { container } = render(<PinInput length={4} onChange={handleChange} />)
    const input = container.querySelector('input')!
    
    fireEvent.change(input, { target: { value: '123456789' } })
    
    expect(handleChange).toHaveBeenCalledWith('1234')
  })

  it('calls onChange with current value', () => {
    const handleChange = vi.fn()
    const { container } = render(<PinInput onChange={handleChange} />)
    const input = container.querySelector('input')!
    
    fireEvent.change(input, { target: { value: '12' } })
    
    expect(handleChange).toHaveBeenCalledWith('12')
  })

  it('calls onComplete when PIN reaches length', () => {
    const handleComplete = vi.fn()
    const { container } = render(<PinInput length={4} onComplete={handleComplete} />)
    const input = container.querySelector('input')!
    
    fireEvent.change(input, { target: { value: '1234' } })
    
    expect(handleComplete).toHaveBeenCalledWith('1234')
  })

  it('does not call onComplete when PIN is shorter than length', () => {
    const handleComplete = vi.fn()
    const { container } = render(<PinInput length={4} onComplete={handleComplete} />)
    const input = container.querySelector('input')!
    
    fireEvent.change(input, { target: { value: '12' } })
    
    expect(handleComplete).not.toHaveBeenCalled()
  })

  it('shows error styling when error prop is true', () => {
    const { container } = render(<PinInput error="Invalid PIN" />)
    const input = container.querySelector('input')!
    
    expect(input).toHaveClass('border-red-500', 'bg-red-50')
  })

  it('shows normal styling when error is not provided', () => {
    const { container } = render(<PinInput />)
    const input = container.querySelector('input')!
    
    expect(input).toHaveClass('border-border', 'bg-surface')
  })

  it('displays custom placeholder', () => {
    render(<PinInput placeholder="*****" length={5} />)
    expect(screen.getByPlaceholderText('*****')).toBeInTheDocument()
  })

  it('renders default placeholder based on length', () => {
    render(<PinInput length={4} />)
    expect(screen.getByPlaceholderText('••••')).toBeInTheDocument()
  })

  it('accepts autoFocus prop', () => {
    const { container } = render(<PinInput autoFocus />)
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
  })

  it('accepts disabled prop', () => {
    const { container } = render(<PinInput disabled />)
    const input = container.querySelector('input')!
    
    expect(input).toBeDisabled()
  })

  it('accepts external value prop', () => {
    const { container } = render(<PinInput value="12345" />)
    const input = container.querySelector('input') as HTMLInputElement
    
    expect(input.value).toBe('12345')
  })

  it('renders with type password', () => {
    const { container } = render(<PinInput />)
    const input = container.querySelector('input')!
    
    expect(input).toHaveAttribute('type', 'password')
  })

  it('sets inputMode to numeric', () => {
    const { container } = render(<PinInput />)
    const input = container.querySelector('input')!
    
    expect(input).toHaveAttribute('inputmode', 'numeric')
  })
})