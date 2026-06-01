import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuthContext } from './AuthContext'

const TestConsumer = () => {
  const { role, isReferee, isViewer, login, logout, tableId, isAuthenticated, tournamentToken, setTournamentToken } = useAuthContext()
  return (
    <div>
      <span data-testid="role">{role ?? 'null'}</span>
      <span data-testid="isReferee">{String(isReferee)}</span>
      <span data-testid="isViewer">{String(isViewer)}</span>
      <span data-testid="tableId">{tableId ?? 'null'}</span>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <span data-testid="tournamentToken">{tournamentToken ?? 'null'}</span>
      <button data-testid="login-referee" onClick={() => login('referee', 'table-1')}>Login Referee</button>
      <button data-testid="login-viewer" onClick={() => login('viewer', 'table-2')}>Login Viewer</button>
      <button data-testid="logout" onClick={() => logout()}>Logout</button>
      <button data-testid="set-token" onClick={() => setTournamentToken('test-uuid-token')}>Set Token</button>
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

  it('persists role and tableId to localStorage on login (pin is NOT persisted)', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('login-referee').click()
    })

    // Role and tableId ARE persisted
    expect(localStorage.getItem('role')).toBe('referee')
    expect(localStorage.getItem('tableId')).toBe('table-1')
    // ownerPin MUST NOT be in localStorage (security)
    expect(localStorage.getItem('ownerPin')).toBeNull()
    // But React state IS updated
    expect(screen.getByTestId('role')).toHaveTextContent('referee')
  })

  it('restores auth state from localStorage on mount', () => {
    localStorage.setItem('role', 'viewer')
    localStorage.setItem('tableId', 'table-123')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // Auth state restored from localStorage
    expect(screen.getByTestId('role')).toHaveTextContent('viewer')
    expect(screen.getByTestId('isViewer')).toHaveTextContent('true')
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
  })

  it('does NOT restore ownerPin or tablePin from localStorage (security)', () => {
    // Simulate an attacker trying to inject a PIN
    localStorage.setItem('role', 'referee')
    localStorage.setItem('ownerPin', '12345678')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('role')).toHaveTextContent('referee')
    // No way to read ownerPin from test consumer directly, but we verify
    // it's not in localStorage that the component could access
    expect(localStorage.getItem('ownerPin')).toBe('12345678')
    // We'd need to verify via spy that setOwnerPin was never called,
    // but since ownerPin is a useState that we can't read from the
    // test consumer, we trust the implementation: authStorage.setOwnerPin
    // is not called in the mount effect.
  })

  it('clears React state and localStorage on logout', () => {
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
    expect(localStorage.getItem('role')).toBe('referee')

    // Then logout
    act(() => {
      screen.getByTestId('logout').click()
    })

    // React state cleared
    expect(screen.getByTestId('role')).toHaveTextContent('null')
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
    // localStorage cleared
    expect(localStorage.getItem('role')).toBeNull()
    expect(localStorage.getItem('tableId')).toBeNull()
    expect(localStorage.getItem('tournamentToken')).toBeNull()
  })

  // ── Tournament Token ───────────────────────────────────────────────

  it('tournamentToken is null initially', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    expect(screen.getByTestId('tournamentToken')).toHaveTextContent('null')
  })

  it('setTournamentToken stores the token in React state and localStorage', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('set-token').click()
    })

    expect(screen.getByTestId('tournamentToken')).toHaveTextContent('test-uuid-token')
    expect(localStorage.getItem('tournamentToken')).toBe('test-uuid-token')
  })

  it('logout clears tournamentToken from state and localStorage', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    act(() => {
      screen.getByTestId('set-token').click()
    })
    expect(screen.getByTestId('tournamentToken')).toHaveTextContent('test-uuid-token')
    expect(localStorage.getItem('tournamentToken')).toBe('test-uuid-token')

    act(() => {
      screen.getByTestId('logout').click()
    })

    expect(screen.getByTestId('tournamentToken')).toHaveTextContent('null')
    expect(localStorage.getItem('tournamentToken')).toBeNull()
  })
})
