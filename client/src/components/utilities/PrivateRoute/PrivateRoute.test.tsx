import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { PrivateRoute } from './PrivateRoute'

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../../hooks/useAuth'

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

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

const mockAuth = (isAuthenticated: boolean, role: string = 'referee') => {
  mockUseAuth.mockReturnValue({
    isAuthenticated,
    user: isAuthenticated ? { id: '1', name: 'Test User', role } : null,
    pin: '',
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
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
    mockAuth(true, 'referee')

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
    mockAuth(true, 'viewer')

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