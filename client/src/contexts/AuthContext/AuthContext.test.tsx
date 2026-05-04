import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuthContext } from './AuthContext'

const TestConsumer = () => {
  const { role, isReferee, isViewer, login, logout, tableId, isAuthenticated } = useAuthContext()
  return (
    <div>
      <span data-testid="role">{role ?? 'null'}</span>
      <span data-testid="isReferee">{String(isReferee)}</span>
      <span data-testid="isViewer">{String(isViewer)}</span>
      <span data-testid="tableId">{tableId ?? 'null'}</span>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <button data-testid="login-referee" onClick={() => login('referee', 'table-1')}>Login Referee</button>
      <button data-testid="login-viewer" onClick={() => login('viewer', 'table-2')}>Login Viewer</button>
      <button data-testid="logout" onClick={() => logout()}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('provides user=null initially', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('role')).toHaveTextContent('null')
  })

  it('provides isReferee=false initially', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('isReferee')).toHaveTextContent('false')
  })

  it('provides isViewer=false initially', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('isViewer')).toHaveTextContent('false')
  })

  it('login() sets user and role correctly', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-referee').click()
    })

    expect(screen.getByTestId('role')).toHaveTextContent('referee')
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
  })

  it('login as referee sets isReferee=true', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-referee').click()
    })

    expect(screen.getByTestId('isReferee')).toHaveTextContent('true')
    expect(screen.getByTestId('isViewer')).toHaveTextContent('false')
  })

  it('login as viewer sets isViewer=true', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-viewer').click()
    })

    expect(screen.getByTestId('isViewer')).toHaveTextContent('true')
    expect(screen.getByTestId('isReferee')).toHaveTextContent('false')
  })

  it('logout() clears user and roles', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-referee').click()
    })
    expect(screen.getByTestId('role')).toHaveTextContent('referee')

    act(() => {
      screen.getByTestId('logout').click()
    })

    expect(screen.getByTestId('role')).toHaveTextContent('null')
    expect(screen.getByTestId('isReferee')).toHaveTextContent('false')
    expect(screen.getByTestId('isViewer')).toHaveTextContent('false')
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
  })

  it('does NOT persist auth state to localStorage (security)', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-referee').click()
    })

    // localStorage must NOT be touched — auth is memory-only
    expect(localStorage.getItem('role')).toBeNull()
    expect(localStorage.getItem('tableId')).toBeNull()
    // But React state IS updated
    expect(screen.getByTestId('role')).toHaveTextContent('referee')
  })

  it('does NOT load persisted auth state from localStorage (security)', () => {
    localStorage.setItem('role', 'viewer')
    localStorage.setItem('tableId', 'table-123')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // Auth state starts fresh — localStorage is NOT trusted for auth
    expect(screen.getByTestId('role')).toHaveTextContent('null')
    expect(screen.getByTestId('isViewer')).toHaveTextContent('false')
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
  })

  it('clears React state on logout (no localStorage interaction)', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // First login to set state
    act(() => {
      screen.getByTestId('login-referee').click()
    })

    expect(screen.getByTestId('role')).toHaveTextContent('referee')

    // Then logout
    act(() => {
      screen.getByTestId('logout').click()
    })

    // React state cleared
    expect(screen.getByTestId('role')).toHaveTextContent('null')
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
  })
})