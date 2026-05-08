import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { KioskAllTablesPage } from './KioskAllTablesPage'
import { useSocketContext } from '@/contexts/SocketContext'
import type { TableInfo } from '@shared/types'

// Mock SocketContext
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'kioskNoActiveMatches': 'No active matches',
        'kioskPageTitle': 'Scoreboard',
      }
      return map[key] || key
    },
  }),
}))

const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>

function makeTable(overrides: Partial<TableInfo> = {}): TableInfo {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    playerCount: 2,
    playerNames: { a: 'Alice', b: 'Bob' },
    currentScore: { a: 5, b: 3 },
    ...overrides,
  }
}

function renderPage(tables: TableInfo[] = []) {
  mockUseSocketContext.mockReturnValue({
    tables,
    connected: true,
    connecting: false,
  })

  return render(
    <MemoryRouter>
      <KioskAllTablesPage />
    </MemoryRouter>
  )
}

describe('KioskAllTablesPage', () => {
  it('renders empty state when no active tables', () => {
    renderPage([{ ...makeTable(), status: 'FINISHED' }])
    expect(screen.getByText('No active matches')).toBeInTheDocument()
  })

  it('renders empty state when tables array is empty', () => {
    renderPage([])
    expect(screen.getByText('No active matches')).toBeInTheDocument()
  })

  it('renders card for each LIVE table', () => {
    const table1 = makeTable({ id: 't1', name: 'Mesa 1', status: 'LIVE' })
    const table2 = makeTable({ id: 't2', name: 'Mesa 2', status: 'LIVE' })
    renderPage([table1, table2])

    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
    expect(screen.getByText('Mesa 2')).toBeInTheDocument()
  })

  it('renders card for each WAITING table', () => {
    const table = makeTable({ id: 't3', name: 'Mesa 3', status: 'WAITING' })
    renderPage([table])

    expect(screen.getByText('Mesa 3')).toBeInTheDocument()
  })

  it('filters out FINISHED tables', () => {
    const live = makeTable({ id: 't1', name: 'Live Table', status: 'LIVE' })
    const finished = makeTable({ id: 't2', name: 'Finished Table', status: 'FINISHED' })
    renderPage([live, finished])

    expect(screen.getByText('Live Table')).toBeInTheDocument()
    expect(screen.queryByText('Finished Table')).not.toBeInTheDocument()
  })

  it('filters out CONFIGURING tables', () => {
    const waiting = makeTable({ id: 't1', name: 'Waiting Table', status: 'WAITING' })
    const configuring = makeTable({ id: 't2', name: 'Configuring Table', status: 'CONFIGURING' })
    renderPage([waiting, configuring])

    expect(screen.getByText('Waiting Table')).toBeInTheDocument()
    expect(screen.queryByText('Configuring Table')).not.toBeInTheDocument()
  })

  it('shows page title Scoreboard', () => {
    const table = makeTable({ status: 'LIVE' })
    renderPage([table])
    expect(screen.getByText('Scoreboard')).toBeInTheDocument()
  })

  it('renders single table grid', () => {
    const table = makeTable({ id: 'lonely', name: 'Only Table', status: 'LIVE' })
    renderPage([table])

    expect(screen.getByText('Only Table')).toBeInTheDocument()
    // One table should still render, not show empty state
    expect(screen.queryByText('No active matches')).not.toBeInTheDocument()
  })

  it('renders grid with mixed LIVE and WAITING', () => {
    const live = makeTable({ id: 't1', name: 'Live Table', status: 'LIVE' })
    const waiting = makeTable({ id: 't2', name: 'Waiting Table', status: 'WAITING' })
    renderPage([live, waiting])

    expect(screen.getByText('Live Table')).toBeInTheDocument()
    expect(screen.getByText('Waiting Table')).toBeInTheDocument()
  })
})
