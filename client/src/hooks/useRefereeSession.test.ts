import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRefereeSession } from './useRefereeSession'
import type { TableInfo } from '@shared/types'

function createTable(overrides: Partial<TableInfo> = {}): TableInfo {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    playerCount: 2,
    playerNames: { a: 'Alice', b: 'Bob' },
    currentScore: { a: 0, b: 0 },
    ...overrides,
  }
}

describe('useRefereeSession', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('saveSession', () => {
    it('stores session in localStorage with table-specific key', () => {
      const { result } = renderHook(() => useRefereeSession())

      act(() => {
        result.current.saveSession('table-1', '4821')
      })

      const raw = localStorage.getItem('rallyos_ref_session_table-1')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.pin).toBe('4821')
      expect(parsed.joinedAt).toBeTypeOf('number')
    })
  })

  describe('getSession', () => {
    it('returns null when no session exists', () => {
      const { result } = renderHook(() => useRefereeSession())
      expect(result.current.getSession('table-1')).toBeNull()
    })

    it('returns session data when stored', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-1',
        JSON.stringify({ pin: '1234', joinedAt: Date.now() }),
      )
      const { result } = renderHook(() => useRefereeSession())

      const session = result.current.getSession('table-1')
      expect(session).not.toBeNull()
      expect(session!.pin).toBe('1234')
    })
  })

  describe('clearSession', () => {
    it('removes session from localStorage', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-1',
        JSON.stringify({ pin: '1234', joinedAt: Date.now() }),
      )
      const { result } = renderHook(() => useRefereeSession())

      act(() => {
        result.current.clearSession('table-1')
      })

      expect(localStorage.getItem('rallyos_ref_session_table-1')).toBeNull()
    })
  })

  describe('findAnyValidSession', () => {
    it('returns session for LIVE table — skips modal', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-1',
        JSON.stringify({ pin: '4821', joinedAt: Date.now() }),
      )
      const tables: TableInfo[] = [createTable({ id: 'table-1', status: 'LIVE' })]
      const { result } = renderHook(() => useRefereeSession())

      const found = result.current.findAnyValidSession(tables)
      expect(found).not.toBeNull()
      expect(found!.tableId).toBe('table-1')
      expect(found!.pin).toBe('4821')
    })

    it('returns session for WAITING table', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-2',
        JSON.stringify({ pin: '9999', joinedAt: Date.now() }),
      )
      const tables: TableInfo[] = [createTable({ id: 'table-2', status: 'WAITING' })]
      const { result } = renderHook(() => useRefereeSession())

      const found = result.current.findAnyValidSession(tables)
      expect(found).not.toBeNull()
      expect(found!.pin).toBe('9999')
    })

    it('returns session for CONFIGURING table', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-3',
        JSON.stringify({ pin: '5678', joinedAt: Date.now() }),
      )
      const tables: TableInfo[] = [createTable({ id: 'table-3', status: 'CONFIGURING' })]
      const { result } = renderHook(() => useRefereeSession())

      const found = result.current.findAnyValidSession(tables)
      expect(found).not.toBeNull()
      expect(found!.pin).toBe('5678')
    })

    it('clears session and returns null for FINISHED table', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-1',
        JSON.stringify({ pin: '4821', joinedAt: Date.now() }),
      )
      const tables: TableInfo[] = [createTable({ id: 'table-1', status: 'FINISHED' })]
      const { result } = renderHook(() => useRefereeSession())

      const found = result.current.findAnyValidSession(tables)
      expect(found).toBeNull()
      // Session should be cleared
      expect(localStorage.getItem('rallyos_ref_session_table-1')).toBeNull()
    })

    it('clears stale session when table not in list', () => {
      localStorage.setItem(
        'rallyos_ref_session_table-missing',
        JSON.stringify({ pin: '0000', joinedAt: Date.now() }),
      )
      const tables: TableInfo[] = [createTable({ id: 'table-1', status: 'LIVE' })]
      const { result } = renderHook(() => useRefereeSession())

      const found = result.current.findAnyValidSession(tables)
      expect(found).toBeNull()
      expect(localStorage.getItem('rallyos_ref_session_table-missing')).toBeNull()
    })

    it('returns null when localStorage is empty', () => {
      const tables: TableInfo[] = [createTable({ id: 'table-1', status: 'LIVE' })]
      const { result } = renderHook(() => useRefereeSession())

      expect(result.current.findAnyValidSession(tables)).toBeNull()
    })
  })

  describe('graceful degradation', () => {
    it('returns null when localStorage is unavailable', () => {
      // Simulate localStorage throwing on access
      const originalGetItem = Storage.prototype.getItem
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.getItem = () => { throw new Error('Storage unavailable') }
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable') }

      const tables: TableInfo[] = [createTable({ id: 'table-1', status: 'LIVE' })]
      const { result } = renderHook(() => useRefereeSession())

      // All operations should return null / not throw
      expect(result.current.getSession('table-1')).toBeNull()
      expect(result.current.findAnyValidSession(tables)).toBeNull()

      // saveSession should not throw
      expect(() => {
        act(() => {
          result.current.saveSession('table-1', '1234')
        })
      }).not.toThrow()

      // Restore
      Storage.prototype.getItem = originalGetItem
      Storage.prototype.setItem = originalSetItem
    })
  })
})
