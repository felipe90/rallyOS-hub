export type UserRole = 'referee' | 'viewer' | null

export interface AuthContextValue {
  role: UserRole
  tableId: string | null
  isReferee: boolean
  isViewer: boolean
  isAuthenticated: boolean
  login: (newRole: UserRole, tId?: string) => void
  logout: () => void
}

export interface AuthProviderProps {
  children: React.ReactNode
}