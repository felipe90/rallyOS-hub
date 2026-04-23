export type UserRole = 'owner' | 'referee' | 'viewer' | null

// Centralized role constants to avoid magic strings
export const UserRoles = {
  OWNER: 'owner' as const,
  REFEREE: 'referee' as const,
  VIEWER: 'viewer' as const,
}

export type UserRoleType = typeof UserRoles[keyof typeof UserRoles]

// Page mode types for Dashboard and Scoreboard
export type DashboardMode = 'owner' | 'referee'
export type ScoreboardMode = 'referee' | 'view'

// Default modes
export const DefaultDashboardMode: DashboardMode = 'owner'
export const DefaultScoreboardMode: ScoreboardMode = 'view'

export interface AuthContextValue {
  role: UserRole
  tableId: string | null
  ownerPin: string | null
  tablePin: string | null
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