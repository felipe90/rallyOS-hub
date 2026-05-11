import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KioskTableCard } from './KioskTableCard'
import type { TableInfo } from '@shared/types'

// Mock i18n — return the key itself so we can verify the key was called
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'kioskStatusLive': 'LIVE',
        'kioskStatusPaused': 'Paused',
        'kioskStatusFinished': 'Finished',
        'commonVs': 'vs',
      }
      return map[key] || key
    },
  }),
}))

function makeTable(overrides: Partial<TableInfo> = {}): TableInfo {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    playerCount: 2,
    playerNames: { a: 'Alice', b: 'Bob' },
    currentScore: { a: 5, b: 3 },
    currentSets: { a: 1, b: 0 },
    ...overrides,
  }
}

describe('KioskTableCard', () => {
  it('renders table name', () => {
    const table = makeTable()
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
  })

  it('renders player A score', () => {
    const table = makeTable()
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders player B score', () => {
    const table = makeTable()
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders player A name', () => {
    const table = makeTable()
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders player B name', () => {
    const table = makeTable()
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows LIVE status badge when status is LIVE', () => {
    const table = makeTable({ status: 'LIVE' })
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows Paused status badge when status is WAITING', () => {
    const table = makeTable({ status: 'WAITING' })
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('shows Finished status badge when status is FINISHED', () => {
    const table = makeTable({ status: 'FINISHED' })
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('Finished')).toBeInTheDocument()
  })

  it('renders scores as zero when currentScore is undefined', () => {
    const table = makeTable({ currentScore: undefined })
    render(<KioskTableCard table={table} />)
    // Both scores default to 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  it('falls back to default player labels when playerNames is missing', () => {
    const table = makeTable({ playerNames: undefined })
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('commonPlayerA')).toBeInTheDocument()
    expect(screen.getByText('commonPlayerB')).toBeInTheDocument()
  })

  it('shows CONFIGURING status as Paused badge', () => {
    const table = makeTable({ status: 'CONFIGURING' })
    render(<KioskTableCard table={table} />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('renders with custom className', () => {
    const table = makeTable()
    const { container } = render(<KioskTableCard table={table} className="custom-class" />)
    expect(container.firstElementChild?.className).toContain('custom-class')
  })
})
