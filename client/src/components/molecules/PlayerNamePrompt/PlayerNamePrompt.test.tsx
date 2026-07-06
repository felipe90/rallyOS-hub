import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlayerNamePrompt } from './PlayerNamePrompt'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubPlayNameA: 'Jugador 1',
        clubPlayNameB: 'Jugador 2',
        clubPlayNamePlaceholder: 'Tu nombre (opcional)',
        clubPlayStartMatch: 'Comenzar partido',
        matchConfigPlayers: 'Jugadores',
      }
      return map[key] || key
    },
  }),
}))

describe('PlayerNamePrompt', () => {
  it('renders player name inputs with labels and submit button', () => {
    const handleSubmit = vi.fn()
    render(<PlayerNamePrompt onSubmit={handleSubmit} />)

    expect(screen.getByText('Jugadores')).toBeInTheDocument()
    expect(screen.getByText('Jugador 1')).toBeInTheDocument()
    expect(screen.getByText('Jugador 2')).toBeInTheDocument()
    expect(screen.getByText('Comenzar partido')).toBeInTheDocument()

    const inputs = screen.getAllByPlaceholderText('Tu nombre (opcional)')
    expect(inputs).toHaveLength(2)
  })

  it('calls onSubmit with default names when inputs are empty', () => {
    const handleSubmit = vi.fn()
    render(<PlayerNamePrompt onSubmit={handleSubmit} />)

    fireEvent.click(screen.getByText('Comenzar partido'))
    expect(handleSubmit).toHaveBeenCalledWith('Jugador 1', 'Jugador 2')
  })

  it('calls onSubmit with entered names', () => {
    const handleSubmit = vi.fn()
    render(<PlayerNamePrompt onSubmit={handleSubmit} />)

    const inputs = screen.getAllByPlaceholderText('Tu nombre (opcional)')
    fireEvent.change(inputs[0], { target: { value: 'Alice' } })
    fireEvent.change(inputs[1], { target: { value: 'Bob' } })
    fireEvent.click(screen.getByText('Comenzar partido'))

    expect(handleSubmit).toHaveBeenCalledWith('Alice', 'Bob')
  })

  it('uses provided default names', () => {
    const handleSubmit = vi.fn()
    render(<PlayerNamePrompt onSubmit={handleSubmit} defaultNameA="Team Red" defaultNameB="Team Blue" />)

    const inputs = screen.getAllByPlaceholderText('Tu nombre (opcional)')
    expect(inputs[0]).toHaveValue('Team Red')
    expect(inputs[1]).toHaveValue('Team Blue')
  })
})
