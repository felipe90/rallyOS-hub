import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TextInput } from './TextInput'

describe('TextInput', () => {
  it('renderiza como input de texto', () => {
    render(<TextInput />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('muestra error state con estilos correctos', () => {
    render(<TextInput error />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('border-red-500')
  })

  it('variants de size funcionan', () => {
    const { rerender } = render(<TextInput inputSize="sm" />)
    expect(screen.getByRole('textbox')).toHaveClass('px-2 py-1 text-sm')

    rerender(<TextInput inputSize="md" />)
    expect(screen.getByRole('textbox')).toHaveClass('px-3 py-2 text-base')

    rerender(<TextInput inputSize="lg" />)
    expect(screen.getByRole('textbox')).toHaveClass('px-4 py-3 text-lg')
  })

  it('placeholder y label se muestran', () => {
    render(<TextInput placeholder="Escribe algo" aria-label="Input label" />)
    expect(screen.getByPlaceholderText('Escribe algo')).toBeInTheDocument()
    expect(screen.getByLabelText('Input label')).toBeInTheDocument()
  })

  it('disabled deshabilita el input', () => {
    render(<TextInput disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('onChange callback se llama', () => {
    const handleChange = vi.fn()
    render(<TextInput onChange={handleChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(handleChange).toHaveBeenCalled()
  })
})