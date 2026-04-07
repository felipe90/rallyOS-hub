import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
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
      expect(document.querySelector('input[placeholder="Enter text"]')).toBeInTheDocument()
    })

    it('renders with label', () => {
      render(<Input label="Name" />)
      expect(document.querySelector('label')).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    it('calls onChange when value changes', () => {
      const handler = vi.fn()
      render(<Input onChange={handler} />)
      fireEvent.change(document.querySelector('input')!, { target: { value: 'test' } })
      expect(handler).toHaveBeenCalled()
    })

    it('shows error message when provided', () => {
      render(<Input error="Error message" />)
      expect(document.querySelector('.text-red-500')).toBeInTheDocument()
    })

    it('shows hint message when provided', () => {
      render(<Input hint="Hint message" />)
      expect(document.body.textContent).toContain('Hint message')
    })
  })

  describe('disabled state', () => {
    it('disables input when disabled prop is true', () => {
      render(<Input disabled />)
      expect(document.querySelector('input')).toBeDisabled()
    })
  })
})

describe('PinInput', () => {
  it('renders input elements', () => {
    render(<PinInput value="" onChange={() => {}} />)
    expect(document.querySelectorAll('input').length).toBeGreaterThan(0)
  })

  it('renders custom number of inputs', () => {
    render(<PinInput value="" onChange={() => {}} length={6} />)
    expect(document.querySelectorAll('input').length).toBe(6)
  })

  it('displays value in inputs', () => {
    render(<PinInput value="1234" onChange={() => {}} />)
    const inputs = document.querySelectorAll('input')
    expect(inputs[0]).toHaveValue('1')
  })
})