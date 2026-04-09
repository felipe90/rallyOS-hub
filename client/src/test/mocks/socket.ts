import { vi } from 'vitest'

export const mockSocketContext = {
  currentMatch: null,
  tables: [],
  connected: true,
  emit: vi.fn(),
  createTable: vi.fn(),
  joinTable: vi.fn(),
  leaveTable: vi.fn(),
  disconnect: vi.fn(),
}