export type UserRole = 'referee' | 'viewer' | null

export function useAuth() {
  const role = localStorage.getItem('role') as UserRole
  const tableId = localStorage.getItem('tableId')
  
  const login = (newRole: UserRole, tId?: string) => {
    if (newRole) {
      localStorage.setItem('role', newRole)
    }
    if (tId) {
      localStorage.setItem('tableId', tId)
    }
  }

  const logout = () => {
    localStorage.removeItem('role')
    localStorage.removeItem('tableId')
  }

  return {
    role,
    tableId,
    isReferee: role === 'referee',
    isViewer: role === 'viewer',
    isAuthenticated: !!role,
    login,
    logout
  }
}
