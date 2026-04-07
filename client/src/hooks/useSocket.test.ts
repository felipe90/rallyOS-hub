import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSocket } from './useSocket'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  })),
}))

describe('useSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    expect(result.current.connected).toBe(false)
    expect(result.current.connecting).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.tables).toEqual([])
    expect(result.current.currentMatch).toBe(null)
  })

  it('connects to server when autoConnect is true', () => {
    const { result } = renderHook(() => useSocket({ 
      autoConnect: true,
      serverUrl: 'http://localhost:3001',
    }))
    
    // Should attempt connection
    expect(result.current.connecting).toBe(true)
  })

  it('disconnects when disconnect is called', async () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    await act(async () => {
      result.current.disconnect()
    })
    
    expect(result.current.connected).toBe(false)
  })

  it('has emit function available', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    expect(typeof result.current.emit).toBe('function')
  })
})

  it('has joinTable function available', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    expect(typeof result.current.joinTable).toBe('function')
  })

  it('has scorePoint function available', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    expect(typeof result.current.scorePoint).toBe('function')
  })

  it('has undoLastPoint function available', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    expect(typeof result.current.undoLastPoint).toBe('function')
  })

  it('has startMatch function available', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }))
    
    expect(typeof result.current.startMatch).toBe('function')
  })
})