export type AuthMode = 'select' | 'pin'

export interface AuthPageProps {
  onLoginSuccess?: (role: 'referee' | 'viewer') => void
}

export interface AuthPageState {
  pin: string
  error: string
  isLoading: boolean
  mode: AuthMode
}

export const DEFAULT_TABLE_PIN = '12345'
