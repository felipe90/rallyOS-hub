import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { PrivateRoute } from './PrivateRoute'
import { AuthProvider } from '../../../contexts/AuthContext'
import { UserRoles } from '../../../contexts/AuthContext/AuthContext.types'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { useAuthContext } from '../../../contexts/AuthContext'

const mockUseAuthContext = useAuthContext as ReturnType<typeof vi.fn>

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, replace)
      return null
    },
  }
})

const mockAuth = (isAuthenticated: boolean, role: string = UserRoles.REFEREE) => {
  mockUseAuthContext.mockReturnValue({
    isAuthenticated,
    role,
    tableId: 'table-1',
    ownerPin: '12345',
    isOwner: role === UserRoles.OWNER,
    isReferee: role === UserRoles.REFEREE,
    isViewer: role === UserRoles.VIEWER,
    login: vi.fn(),
    logout: vi.fn(),
    setOwner: vi.fn(),
    setTablePin: vi.fn(),
  })
}

describe('PrivateRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows access when authenticated', () => {
    mockAuth(true)

    const routes = [
      {
        path: '/',
        element: <PrivateRoute />,
        children: [{ path: '/', element: <div>Protected Content</div> }],
      },
    ]

    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /auth when not authenticated', () => {
    mockAuth(false)

    const routes = [
      {
        path: '/',
        element: <PrivateRoute />,
        children: [{ path: '/', element: <div>Protected Content</div> }],
      },
    ]

    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/auth', true)
  })

  it('works with different roles - referee', () => {
    mockAuth(true, UserRoles.REFEREE)

    const routes = [
      {
        path: '/',
        element: <PrivateRoute />,
        children: [{ path: '/', element: <div>Referee Content</div> }],
      },
    ]

    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByText('Referee Content')).toBeInTheDocument()
  })

  it('works with different roles - viewer', () => {
    mockAuth(true, UserRoles.VIEWER)

    const routes = [
      {
        path: '/',
        element: <PrivateRoute />,
        children: [{ path: '/', element: <div>Viewer Content</div> }],
      },
    ]

    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByText('Viewer Content')).toBeInTheDocument()
  })
})