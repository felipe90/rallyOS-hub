import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tab } from './Tab'

describe('Tab', () => {
  it('renders the label as a tab button', () => {
    render(<Tab id="courts" label="Canchas" active onClick={() => {}} />)
    const tab = screen.getByRole('tab', { name: 'Canchas' })
    expect(tab).toBeInTheDocument()
    expect(tab).toHaveTextContent('Canchas')
  })

  it('marks the active tab via aria-selected', () => {
    render(<Tab id="courts" label="Canchas" active onClick={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Canchas' })).toHaveAttribute('aria-selected', 'true')
  })

  it('marks an inactive tab via aria-selected=false', () => {
    render(<Tab id="history" label="Historial" active={false} onClick={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'false')
  })

  it('fires onClick when the trigger is clicked', () => {
    const onClick = vi.fn()
    render(<Tab id="courts" label="Canchas" active={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Canchas' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a disabled tab that does not fire onClick', () => {
    const onClick = vi.fn()
    render(<Tab id="history" label="Historial" active={false} disabled onClick={onClick} />)
    const tab = screen.getByRole('tab', { name: 'Historial' })
    expect(tab).toBeDisabled()
    fireEvent.click(tab)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('links trigger to its panel via aria-controls', () => {
    render(<Tab id="history" label="Historial" active onClick={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-controls', 'tabpanel-history')
  })
})