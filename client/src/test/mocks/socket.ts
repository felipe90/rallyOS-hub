import { vi } from 'vitest'
import type { AllHistoryEntry } from '@shared/types'

export const mockSocketContext = {
  currentMatch: null,
  allHistories: [] as AllHistoryEntry[],
  tables: [],
  connected: true,
  emit: vi.fn(),
  createTable: vi.fn(),
  joinTable: vi.fn(),
  leaveTable: vi.fn(),
  disconnect: vi.fn(),
}
