import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormField } from './index'

describe('FormField', () => {
  it('renders label correctly', () => {
    render(
      <FormField label="Username">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('shows required asterisk when required=true', () => {
    render(
      <FormField label="Username" required>
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows error message when error exists', () => {
    render(
      <FormField label="Username" error="Invalid username">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('Invalid username')).toBeInTheDocument()
  })

  it('shows helper text when helperText exists', () => {
    render(
      <FormField label="Username" helperText="Enter your username">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('Enter your username')).toBeInTheDocument()
  })

  it('children renders in the container', () => {
    render(
      <FormField label="Username">
        <input type="text" data-testid="child-input" />
      </FormField>
    )
    expect(screen.getByTestId('child-input')).toBeInTheDocument()
  })

  it('does not show helper text when error exists', () => {
    render(
      <FormField label="Username" error="Error" helperText="Hint">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
  })
})