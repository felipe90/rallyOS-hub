import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabContainer } from './TabContainer'

const sampleTabs = [
  { id: 'courts', label: 'Canchas', content: <p>Courts content</p> },
  { id: 'history', label: 'Historial', content: <p>History content</p> },
]

describe('TabContainer', () => {
  it('renders a tab list with all tab labels', () => {
    render(<TabContainer tabs={sampleTabs} />)
    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Canchas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument()
  })

  it('defaults to the first tab as active and renders its content panel', () => {
    render(<TabContainer tabs={sampleTabs} />)
    expect(screen.getByRole('tab', { name: 'Canchas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'false')
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('Courts content')
  })

  it('honours defaultTab to preselect a different tab', () => {
    render(<TabContainer tabs={sampleTabs} defaultTab="history" />)
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('History content')
  })

  it('switches the active panel when another trigger is clicked', () => {
    render(<TabContainer tabs={sampleTabs} />)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Courts content')
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Canchas' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('History content')
  })

  it('ignores clicks on disabled tabs and keeps the current panel', () => {
    const tabs = [
      { id: 'courts', label: 'Canchas', content: <p>Courts content</p> },
      { id: 'history', label: 'Historial', content: <p>History content</p>, disabled: true },
    ]
    render(<TabContainer tabs={tabs} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    // Disabled tab click is ignored — Canchas remains active
    expect(screen.getByRole('tab', { name: 'Canchas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Courts content')
  })

  it('exposes the active panel with role=tabpanel and aria-labelledby matching the tab', () => {
    render(<TabContainer tabs={sampleTabs} defaultTab="history" />)
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-history')
  })

  it('renders a single tabpanel at a time', () => {
    render(<TabContainer tabs={sampleTabs} />)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })

  it('tolerates an empty tabs array without crashing', () => {
    render(<TabContainer tabs={[]} />)
    expect(screen.queryByRole('tablist')).toBeInTheDocument()
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()
  })
})