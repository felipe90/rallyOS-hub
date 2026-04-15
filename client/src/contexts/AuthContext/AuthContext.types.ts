export type UserRole = 'owner' | 'referee' | 'viewer' | null

export interface AuthContextValue {
  role: UserRole
  tableId: string | null
  ownerPin: string | null
  isOwner: boolean
  isReferee: boolean
  isViewer: boolean
  isAuthenticated: boolean
  login: (newRole: UserRole, tId?: string, pin?: string) => void
  logout: () => void
  setOwner: (isOwner: boolean, pin?: string) => void
  setTablePin: (pin: string) => void
}

export interface AuthProviderProps {
  children: React.ReactNode
}