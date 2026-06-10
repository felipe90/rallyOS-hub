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
      <span data-testid="courts-count">{context.courts.length}</span>
      <span data-testid="currentMatch">{String(context.currentMatch)}</span>
      <button data-testid="emit-btn" onClick={() => context.emit('test-event', { foo: 'bar' })}>Emit</button>
      <button data-testid="createCourt-btn" onClick={() => context.createCourt('test-court')}>Create Court</button>
      <button data-testid="joinCourt-btn" onClick={() => context.joinCourt('court-1', '1234', 'referee')}>Join Court</button>
      <button data-testid="leaveTable-btn" onClick={() => context.emit('LEAVE_COURT')}>Leave Court</button>
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
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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

    expect(screen.getByTestId('courts-count')).toHaveTextContent('0')
  })

  it('provides currentMatch=null initially', () => {
    const mockSocketValue = {
      connected: false,
      connecting: false,
      error: null,
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: emitFn,
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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

  it('createCourt() creates new court', () => {
    const createCourtFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createCourt: createCourtFn,
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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

    screen.getByTestId('createCourt-btn').click()

    expect(createCourtFn).toHaveBeenCalledWith('test-court')
  })

  it('joinCourt() joins existing court', () => {
    const joinCourtFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      createCourt: vi.fn(),
      joinCourt: joinCourtFn,
      requestCourts: vi.fn(),
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

    screen.getByTestId('joinCourt-btn').click()

    expect(joinCourtFn).toHaveBeenCalledWith('court-1', '1234', 'referee')
  })

  it('leaveTable() leaves the table', () => {
    const emitFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: emitFn,
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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

    expect(emitFn).toHaveBeenCalledWith('LEAVE_COURT')
  })

  it('disconnect() works correctly', () => {
    const disconnectFn = vi.fn()
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: disconnectFn,
      emit: vi.fn(),
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
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
    const mockCourts = [
      { id: 'court-1', name: 'Court 1', pin: '1234', players: [], status: 'waiting' },
      { id: 'court-2', name: 'Court 2', pin: '5678', players: [], status: 'waiting' }
    ]
    
    const mockSocketValue = {
      connected: true,
      connecting: false,
      error: null,
      courts: [],
      currentCourt: null,
      currentMatch: null,
      socket: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: mockEmit,
      createCourt: vi.fn(),
      joinCourt: vi.fn(),
      requestCourts: vi.fn(),
      scorePoint: vi.fn(),
      undoLastPoint: vi.fn(),
      startMatch: vi.fn(),
    }
    
    mockUseSocket.mockImplementation((options) => {
      return {
        ...mockSocketValue,
        courts: options?.autoConnect ? mockCourts : []
      }
    })

    const { rerender } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    )

    expect(screen.getByTestId('courts-count')).toHaveTextContent('2')
  })
})