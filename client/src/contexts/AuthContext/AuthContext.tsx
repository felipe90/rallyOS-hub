import React, { createContext, useContext, useState, useEffect } from 'react'

export type UserRole = 'referee' | 'viewer' | null

interface AuthContextValue {
  role: UserRole
  tableId: string | null
  isReferee: boolean
  isViewer: boolean
  isAuthenticated: boolean
  login: (newRole: UserRole, tId?: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('role') as UserRole
    }
    return null
  })
  
  const [tableId, setTableId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tableId') || null
    }
    return null
  })

  const login = (newRole: UserRole, tId?: string) => {
    if (newRole) {
      localStorage.setItem('role', newRole)
      setRole(newRole)
    }
    if (tId) {
      localStorage.setItem('tableId', tId)
      setTableId(tId)
    }
  }

  const logout = () => {
    localStorage.removeItem('role')
    localStorage.removeItem('tableId')
    setRole(null)
    setTableId(null)
  }

  const value: AuthContextValue = {
    role,
    tableId,
    isReferee: role === 'referee',
    isViewer: role === 'viewer',
    isAuthenticated: !!role,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}