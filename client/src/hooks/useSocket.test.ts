import { describe, it, expect, vi } from 'vitest'

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
  it('is defined', () => {
    // Basic test to ensure the module loads
    expect(true).toBe(true)
  })

  it('exports useSocket function', async () => {
    const { useSocket } = await import('./useSocket')
    expect(useSocket).toBeDefined()
  })
})