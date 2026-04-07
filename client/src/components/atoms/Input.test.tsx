import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input, PinInput } from '../atoms/Input'
import React from 'react'

describe('Input', () => {
  describe('rendering', () => {
    it('renders input element', () => {
      render(<Input />)
      expect(document.querySelector('input')).toBeInTheDocument()
    })

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('renders with label', () => {
      render(<Input label="Name" />)
      expect(screen.getByText('Name')).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    it('calls onChange when value changes', () => {
      const handler = vi.fn()
      render(<Input onChange={handler} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'test' } })
      expect(handler).toHaveBeenCalled()
    })

    it('shows error message when provided', () => {
      render(<Input error="Error message" />)
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('shows hint message when provided', () => {
      render(<Input hint="Hint message" />)
      expect(screen.getByText('Hint message')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables input when disabled prop is true', () => {
      render(<Input disabled />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })
  })
})

describe('PinInput', () => {
  it('renders 4 digit inputs by default', () => {
    render(<PinInput value="" onChange={() => {}} />)
    const inputs = document.querySelectorAll('input')
    expect(inputs).toHaveLength(4)
  })

  it('renders custom length', () => {
    render(<PinInput value="" onChange={() => {}} length={6} />)
    const inputs = document.querySelectorAll('input')
    expect(inputs).toHaveLength(6)
  })

  it('displays value in inputs', () => {
    render(<PinInput value="1234" onChange={() => {}} />)
    const inputs = document.querySelectorAll('input')
    expect(inputs[0]).toHaveValue('1')
    expect(inputs[1]).toHaveValue('2')
    expect(inputs[2]).toHaveValue('3')
    expect(inputs[3]).toHaveValue('4')
  })
})