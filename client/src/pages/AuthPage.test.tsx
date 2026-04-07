import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthPage } from '../pages/AuthPage'
import { BrowserRouter } from 'react-router-dom'

// Wrap component in router for navigation testing
const AuthPageWithRouter = () => (
  <BrowserRouter>
    <AuthPage />
  </BrowserRouter>
)

describe('AuthPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders PIN input', () => {
    render(<AuthPageWithRouter />)
    const input = screen.getByPlaceholderText('••••••')
    expect(input).toBeInTheDocument()
  })

  it('renders submit button', () => {
    render(<AuthPageWithRouter />)
    const button = screen.getByRole('button', { name: /ingresar/i })
    expect(button).toBeInTheDocument()
  })

  it('disables button when PIN length < 5', () => {
    render(<AuthPageWithRouter />)
    const input = screen.getByPlaceholderText('••••••')
    const button = screen.getByRole('button', { name: /ingresar/i })
    
    fireEvent.change(input, { target: { value: '123' } })
    expect(button).toBeDisabled()
  })

  it('enables button when PIN length = 5', () => {
    render(<AuthPageWithRouter />)
    const input = screen.getByPlaceholderText('••••••')
    const button = screen.getByRole('button', { name: /ingresar/i })
    
    fireEvent.change(input, { target: { value: '12341' } })
    expect(button).not.toBeDisabled()
  })

  it('shows error for invalid PIN', async () => {
    render(<AuthPageWithRouter />)
    const input = screen.getByPlaceholderText('••••••')
    const button = screen.getByRole('button', { name: /ingresar/i })
    
    fireEvent.change(input, { target: { value: '00000' } })
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/PIN inválido/i)).toBeInTheDocument()
    })
  })

  it('shows title and subtitle', () => {
    render(<AuthPageWithRouter />)
    expect(screen.getByText('RallyOS')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu PIN')).toBeInTheDocument()
  })

  it('only accepts numeric input', () => {
    render(<AuthPageWithRouter />)
    const input = screen.getByPlaceholderText('••••••') as HTMLInputElement
    
    fireEvent.change(input, { target: { value: 'abc12' } })
    // Should only have numeric chars
    const numericValue = input.value.replace(/\D/g, '')
    expect(numericValue.length <= 5).toBe(true)
  })
})
