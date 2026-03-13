import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface User {
  id: number
  username: string
  email: string
  is_active: number
  created_at: string
}

export interface AuthState {
  user: User | null
  token: string | null
}

interface AuthContextType {
  auth: AuthState
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [auth, setAuth] = useState<AuthState>(() => {
    // Initialize from localStorage
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    const user = userStr ? JSON.parse(userStr) : null
    return { token, user }
  })

  useEffect(() => {
    // Persist to localStorage whenever auth changes
    if (auth.token) {
      localStorage.setItem('token', auth.token)
    } else {
      localStorage.removeItem('token')
    }

    if (auth.user) {
      localStorage.setItem('user', JSON.stringify(auth.user))
    } else {
      localStorage.removeItem('user')
    }
  }, [auth])

  const login = (token: string, user: User) => {
    setAuth({ token, user })
  }

  const logout = () => {
    setAuth({ token: null, user: null })
    // Clear all cached queries
    queryClient.clear()
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
