import { Navigate, Outlet } from 'react-router-dom'
import { useAuthContext } from '../../../contexts/AuthContext'

export function PrivateRoute() {
  const { isAuthenticated, isRestoring } = useAuthContext()

  if (isRestoring) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
