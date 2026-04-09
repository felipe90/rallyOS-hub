import { vi } from 'vitest'

export const mockAuthContext = {
  user: null,
  role: null as 'referee' | 'viewer' | null,
  tableId: undefined as string | undefined,
  isReferee: false,
  isViewer: false,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
}