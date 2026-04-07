import { describe, it, expect } from 'vitest'
import { useAuth } from '../hooks/useAuth'
import { renderHook } from '@testing-library/react'

describe('useAuth hook', () => {
  it('returns initial auth state', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.role).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('allows login', () => {
    // Clear localStorage
    localStorage.clear()
    
    const { result } = renderHook(() => useAuth())
    result.current.login('referee')
    
    // Re-render to get updated state
    const { result: result2 } = renderHook(() => useAuth())
    expect(result2.current.role).toBe('referee')
    expect(result2.current.isReferee).toBe(true)
  })

  it('allows logout', () => {
    localStorage.clear()
    localStorage.setItem('role', 'referee')
    
    const { result } = renderHook(() => useAuth())
    result.current.logout()
    
    const { result: result2 } = renderHook(() => useAuth())
    expect(result2.current.role).toBeNull()
    expect(result2.current.isAuthenticated).toBe(false)
  })

  it('distinguishes between referee and viewer', () => {
    localStorage.clear()
    localStorage.setItem('role', 'viewer')
    
    const { result } = renderHook(() => useAuth())
    expect(result.current.isReferee).toBe(false)
    expect(result.current.isViewer).toBe(true)
  })

  it('stores tableId', () => {
    localStorage.clear()
    
    const { result } = renderHook(() => useAuth())
    result.current.login('referee', 'table-123')
    
    const { result: result2 } = renderHook(() => useAuth())
    expect(result2.current.tableId).toBe('table-123')
  })
})
