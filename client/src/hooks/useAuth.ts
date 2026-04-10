export type UserRole = 'referee' | 'viewer' | 'owner' | null

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
  
  const setOwner = (isOwner: boolean) => {
    if (isOwner) {
      localStorage.setItem('role', 'owner')
    }
  }
  
  return {
    role,
    tableId,
    isReferee: role === 'referee',
    isViewer: role === 'viewer',
    isOwner: role === 'owner',
    isAuthenticated: !!role,
    login,
    logout,
    setOwner
  }
}