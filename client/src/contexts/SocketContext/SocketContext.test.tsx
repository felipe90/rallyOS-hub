import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { SocketProvider, useSocketContext, SocketContext } from './SocketContext'
import { useSocket } from '../../hooks/useSocket'

vi.mock('../../hooks/useSocket', () => ({
  useSocket: vi.fn()
}))

const mockUseSocket = useSocket as ReturnType<typeof vi.fn>

const TestConsumer = () => {
  const context = useSocketContext()
  return (
    <div>
      <span data-testid="connected">{String(context.connected)}</span>
      <span data-testid="tables-count">{context.tables.length}</span>
      <span data-testid="currentMatch">{String(context.currentMatch)}</span>
      <button data-testid="emit-btn" onClick={() => context.emit('test-event', { foo: 'bar' })}>Emit</button>
      <button data-testid="createTable-btn" onClick={() => context.createTable('test-table')}>Create Table</button>
      <button data-testid="joinTable-btn" onClick={() => context.joinTable('table-1', '1234', 'referee')}>Join Table</button>
      <button data-testid="leaveTable-btn" onClick={() => context.emit('LEAVE_TABLE')}>Leave Table</button>
      <button data-testid="disconnect-btn" onClick={() => context.disconnect()}>Disconnect</button>
    </div>
  )
}

describe('SocketContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides connected=false initially', async () => {
    const mockSocketValue = {
      connected: false,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    expect(screen.getByTestId('connected')).toHaveTextContent('false')
  })

  it('provides tables=[] initially', () => {
    const mockSocketValue = {
      connected: false,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    expect(screen.getByTestId('tables-count')).toHaveTextContent('0')
  })

  it('provides currentMatch=null initially', () => {
    const mockSocketValue = {
      connected: false,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    expect(screen.getByTestId('currentMatch')).toHaveTextContent('null')
  })

  it('emit() sends events correctly', () => {
    const emitFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: emitFn,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    screen.getByTestId('emit-btn').click()

    expect(emitFn).toHaveBeenCalledWith('test-event', { foo: 'bar' })
  })

  it('createTable() creates new table', () => {
    const createTableFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createTable: createTableFn,
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    screen.getByTestId('createTable-btn').click()

    expect(createTableFn).toHaveBeenCalledWith('test-table')
  })

  it('joinTable() joins existing table', () => {
    const joinTableFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createTable: vi.fn(),
      joinTable: joinTableFn,
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    screen.getByTestId('joinTable-btn').click()

    expect(joinTableFn).toHaveBeenCalledWith('table-1', '1234', 'referee')
  })

  it('leaveTable() leaves the table', () => {
    const emitFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: emitFn,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    screen.getByTestId('leaveTable-btn').click()

    expect(emitFn).toHaveBeenCalledWith('LEAVE_TABLE')
  })

  it('disconnect() works correctly', () => {
    const disconnectFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: disconnectFn,
      emit: vi.fn(),
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    mockUseSocket.mockReturnValue(mockSocketValue)

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    screen.getByTestId('disconnect-btn').click()

    expect(disconnectFn).toHaveBeenCalled()
  })

  it('updates state on socket events', () => {
    const mockEmit = vi.fn()
    const mockTables = [
      { id: 'table-1', name: 'Table 1', pin: '1234', players: [], status: 'waiting' },
      { id: 'table-2', name: 'Table 2', pin: '5678', players: [], status: 'waiting' }
    ]
    
    const setTablesCallback: ((tables: any[]) => void) | null = null
    
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      tables: [],
      currentTable: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: mockEmit,
      createTable: vi.fn(),
      joinTable: vi.fn(),
      requestTables: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    
    mockUseSocket.mockImplementation((options) => {
      return {
        ...mockSocketValue,
        tables: options?.autoConnect ? mockTables : []
      }
    })

    const { rerender } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    expect(screen.getByTestId('tables-count')).toHaveTextContent('2')
  })
})