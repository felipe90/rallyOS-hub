import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { PageHeader } from './index'
import { renderWithProviders } from '@/test/test-utils'

describe('PageHeader', () => {
  it('renders title correctly', () => {
    renderWithProviders(<PageHeader title="Test Title" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Title')
  })

  it('renders subtitle when provided', () => {
    renderWithProviders(<PageHeader title="Test" subtitle="Test Subtitle" />)
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
  })

  it('shows ConnectionStatus by default (showStatus=true)', () => {
    renderWithProviders(<PageHeader title="Test" showStatus={true} />)
    expect(screen.getByText('RallyOS')).toBeInTheDocument()
  })

  it('hides ConnectionStatus when showStatus=false', () => {
    renderWithProviders(<PageHeader title="Test" showStatus={false} />)
    expect(screen.queryByText('RallyOS')).not.toBeInTheDocument()
  })

  it('renders action slots correctly', () => {
    const action = <button>Action</button>
    renderWithProviders(<PageHeader title="Test" actions={action} />)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('hides in landscape when landscape=true', () => {
    const { container } = renderWithProviders(<PageHeader title="Test" landscape={true} />)
    const wrapper = container.querySelector('.landscape\\:hidden')
    expect(wrapper).toBeInTheDocument()
  })

  it('handles multiple action buttons', () => {
    const actions = (
      <>
        <button>Action 1</button>
        <button>Action 2</button>
      </>
    )
    renderWithProviders(<PageHeader title="Test" actions={actions} />)
    expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeInTheDocument()
  })
})