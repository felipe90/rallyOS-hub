import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function PrivateRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
