import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberInput } from './NumberInput'

describe('NumberInput', () => {
  it('solo acepta números', () => {
    const handleChange = vi.fn()
    render(<NumberInput onChange={handleChange} showButtons={false} />)
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('botón increment aumenta el valor', () => {
    const handleIncrement = vi.fn()
    render(<NumberInput value={5} onIncrement={handleIncrement} />)
    
    const incrementButton = screen.getByRole('button', { name: /increase/i })
    fireEvent.click(incrementButton)
    
    expect(handleIncrement).toHaveBeenCalled()
  })

  it('botón decrement disminuye el valor', () => {
    const handleDecrement = vi.fn()
    render(<NumberInput value={5} onDecrement={handleDecrement} />)
    
    const decrementButton = screen.getByRole('button', { name: /decrease/i })
    fireEvent.click(decrementButton)
    
    expect(handleDecrement).toHaveBeenCalled()
  })

  it('input directo cambia el valor', () => {
    const handleChange = vi.fn()
    render(<NumberInput onChange={handleChange} showButtons={false} />)
    
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '42' } })
    
    expect(handleChange).toHaveBeenCalledWith(42)
  })

  it('disabled deshabilita todo', () => {
    render(<NumberInput disabled value={5} onIncrement={() => {}} onDecrement={() => {}} />)
    
    expect(screen.getByRole('spinbutton')).toBeDisabled()
    expect(screen.getByRole('button', { name: /increase/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /decrease/i })).toBeDisabled()
  })
})