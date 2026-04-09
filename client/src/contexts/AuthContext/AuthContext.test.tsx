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

  it('persists auth state to localStorage', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-referee').click()
    })

    expect(localStorage.getItem('role')).toBe('referee')
    expect(localStorage.getItem('tableId')).toBe('table-1')
  })

  it('loads persisted auth state from localStorage', () => {
    localStorage.setItem('role', 'viewer')
    localStorage.setItem('tableId', 'table-123')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('role')).toHaveTextContent('viewer')
    expect(screen.getByTestId('isViewer')).toHaveTextContent('true')
    expect(screen.getByTestId('tableId')).toHaveTextContent('table-123')
  })

  it('clears localStorage on logout', () => {
    localStorage.setItem('role', 'referee')
    localStorage.setItem('tableId', 'table-1')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('logout').click()
    })

    expect(localStorage.getItem('role')).toBeNull()
    expect(localStorage.getItem('tableId')).toBeNull()
  })
})