import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from './index'

describe('Select', () => {
  const options = [
    { value: '', label: 'Sin mesa' },
    { value: 'c1', label: 'Mesa 1' },
    { value: 'c2', label: 'Mesa 2' },
  ]

  it('renders a native select with all options', () => {
    render(<Select options={options} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    for (const opt of options) {
      expect(screen.getByRole('option', { name: opt.label })).toBeInTheDocument()
    }
  })

  it('calls onChange with the raw value', () => {
    const handleChange = vi.fn()
    render(<Select options={options} onChange={handleChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    expect(handleChange).toHaveBeenCalledWith('c1')
  })

  it('renders the label and forwards it to the option list', () => {
    render(<Select options={options} label="Asignar mesa" />)
    expect(screen.getByText('Asignar mesa')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(<Select options={options} error="Requerido" />)
    expect(screen.getByText('Requerido')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveClass('ring-red-500/50')
  })
})
