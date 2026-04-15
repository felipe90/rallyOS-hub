import { Navigate, Outlet } from 'react-router-dom'
import { useAuthContext } from '../../../contexts/AuthContext'

export function PrivateRoute() {
  const { isAuthenticated } = useAuthContext()

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
