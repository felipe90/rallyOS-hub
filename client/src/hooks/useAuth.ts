// @deprecated - Use useAuthContext from @/contexts/AuthContext instead
import { UserRoles } from '@/contexts/AuthContext/AuthContext.types'

export type UserRole = 'referee' | 'viewer' | 'owner' | null

export function useAuth() {
  const role = localStorage.getItem('role') as UserRole
  const tableId = localStorage.getItem('tableId')
  const ownerPin = localStorage.getItem('ownerPin')
  
  const login = (newRole: UserRole, tId?: string, pin?: string) => {
    if (newRole) {
      localStorage.setItem('role', newRole)
    }
    if (tId) {
      localStorage.setItem('tableId', tId)
    }
    if (pin) {
      localStorage.setItem('ownerPin', pin)
    }
  }
  
  const logout = () => {
    localStorage.removeItem('role')
    localStorage.removeItem('tableId')
    localStorage.removeItem('ownerPin')
  }

  const setOwner = (isOwner: boolean, pin?: string) => {
    if (isOwner) {
      localStorage.setItem('role', UserRoles.OWNER)
      if (pin) {
        localStorage.setItem('ownerPin', pin)
      }
    }
  }
  
  return {
    role,
    tableId,
    ownerPin,
    isReferee: role === UserRoles.REFEREE,
    isViewer: role === UserRoles.VIEWER,
    isOwner: role === UserRoles.OWNER,
    isAuthenticated: !!role,
    login,
    logout,
    setOwner
  }
}